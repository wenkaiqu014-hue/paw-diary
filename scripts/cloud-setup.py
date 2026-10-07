#!/usr/bin/env python3
"""Project-scoped CloudBase operations. Never persist management credentials.

Default is read-only inspection; writes require a named subcommand. All requests
are pinned to the user-owned paw-diary environment. API results are allowlisted
before they reach stdout/logs. publish_key is saved only to the ignored public
configuration artifact, and is never printed.
"""
import argparse
import base64
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import time
import zipfile
from datetime import datetime, timezone, timedelta

ENV_ID = 'paw-diary-d8g3p4tlsb305221d'
REGION = 'ap-shanghai'
COLLECTIONS = ('health_workspaces', 'health_receipts', 'media_assets', 'import_batches', 'import_maps')
DOMAINS = ('wenkaiqu014-hue.github.io', 'localhost', '127.0.0.1')
ACCEPTANCE_DOMAINS = ('localhost:4193', '127.0.0.1:4193')
FUNCTIONS = ('paw-api', 'paw-stage2-readiness')
ROOT = Path(__file__).resolve().parents[1]
LOG = ROOT / 'test-results/stage2/cloud-ops.log'
PUBLIC_CONFIG = ROOT / 'test-results/stage2/public-config.json'
PENDING_ORDER = Path('/tmp/paw-cloud-ops-tools/purchase-pending.json')
PAID_ENVIRONMENT = ROOT / 'test-results/stage2/paid-environment.json'
DENY_RULE = json.dumps({'read': False, 'write': False}, separators=(',', ':'))


def emit(action, **summary):
    record = {'time': datetime.now(timezone(timedelta(hours=8))).isoformat(timespec='seconds'), 'action': action, **summary}
    line = json.dumps(record, ensure_ascii=False, sort_keys=True)
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open('a', encoding='utf8') as target:
        target.write(line + '\n')
    print(line, flush=True)


def safe_error(error):
    message = error.get_message() if hasattr(error, 'get_message') else type(error).__name__
    for name in ('TENCENTCLOUD_FUJI_SECRET_ID', 'TENCENTCLOUD_FUJI_SECRET_KEY'):
        value = os.environ.get(name)
        if value:
            message = message.replace(value, '[REDACTED]')
    message = re.sub(r'eyJ[A-Za-z0-9._-]+', '[TOKEN]', message)
    message = re.sub(r'AKID[A-Za-z0-9]+', '[SECRET_ID]', message)
    message = re.sub(r'(?<![A-Za-z0-9])\d{20,}(?![A-Za-z0-9])', '[ORDER_ID]', message)
    return {'code': error.get_code() if hasattr(error, 'get_code') else type(error).__name__, 'message': message[:600]}


def load_pending_order():
    # Never accept an order ID on the command line or discover account-wide
    # orders. The one known API receipt remains outside Git, mode 0600.
    if not PENDING_ORDER.is_file() or PENDING_ORDER.stat().st_mode & 0o077:
        raise ValueError('Known pending order file must exist with mode 0600')
    state = json.loads(PENDING_ORDER.read_text(encoding='utf8'))
    order_id = (state.get('result') or {}).get('TranId')
    if not isinstance(order_id, str) or not order_id or state.get('amountFen') != 1990:
        raise ValueError('Known purchase receipt does not match the approved order')
    return state, order_id


def validate_pending_deal(deal, known_order_id):
    if deal.get('OrderId') != known_order_id:
        raise ValueError('Order receipt mismatch')
    if deal.get('RealTotalCost') != 1990 or deal['RealTotalCost'] > 2000:
        raise ValueError('Order price exceeds or differs from the approved 19.90 yuan')
    if deal.get('Currency') != 'CNY' or deal.get('TimeSpan') != 1 or deal.get('TimeUnit') != 'm':
        raise ValueError('Order must be one month in CNY')
    if deal.get('ProductCode') != 'p_tcb' or deal.get('SubProductCode') != 'sp_tcb_personal' or deal.get('Action') != 'purchase':
        raise ValueError('Order must be the approved CloudBase personal purchase')
    if deal.get('Status') not in (1, 2, 3, 4, 12):
        raise ValueError('Order is not unpaid, paid, or pending shipment')


def authorized_paid_environment():
    if not PAID_ENVIRONMENT.is_file() or not PENDING_ORDER.is_file():
        return None
    state, _ = load_pending_order()
    approved = json.loads(PAID_ENVIRONMENT.read_text(encoding='utf8'))
    ids = (state.get('payment') or {}).get('ResourceIds') or state.get('verifiedPaidResourceIds') or []
    candidate = approved.get('envId')
    return candidate if isinstance(candidate, str) and candidate in ids and approved.get('amountFen') == 1990 and approved.get('months') == 1 and approved.get('alias') == 'paw-diary-prod' else None


def recheck_paid_pending(pay=False, funds_confirmed_by_root=False):
    """Read one known order. Pay only after later explicit root confirmation.

    This function never creates orders, recharges, upgrades, changes accounts,
    enables automatic renewal, or enables overrun. Repeated calls cannot pay an
    already paid order. Only the exact approved one-month 1990-fen order passes.
    """
    if pay and not funds_confirmed_by_root:
        raise ValueError('A later explicit root funds confirmation is required')
    state, order_id = load_pending_order()
    from tencentcloud.common import credential
    from tencentcloud.billing.v20180709 import billing_client, models
    client = billing_client.BillingClient(credential.Credential(os.environ['TENCENTCLOUD_FUJI_SECRET_ID'], os.environ['TENCENTCLOUD_FUJI_SECRET_KEY']), REGION)
    started = datetime.fromisoformat(state['start'].replace('Z', '+00:00')).astimezone(timezone(timedelta(hours=8)))
    request = models.DescribeDealsByCondRequest()
    request.from_json_string(json.dumps({'StartTime': (started - timedelta(minutes=1)).strftime('%Y-%m-%d %H:%M:%S'), 'EndTime': (datetime.now(timezone(timedelta(hours=8))) + timedelta(minutes=1)).strftime('%Y-%m-%d %H:%M:%S'), 'Limit': 20, 'Offset': 0, 'OrderId': order_id, 'StatusSet': [1, 2, 3, 4, 5, 7, 8, 9, 10, 12]}))
    result = json.loads(client.DescribeDealsByCond(request).to_json_string())
    deals = result.get('Deals') or []
    if len(deals) != 1:
        raise ValueError('Exactly one matching known order is required')
    deal = deals[0]
    validate_pending_deal(deal, order_id)
    emit('knownOrderRecheck', state=deal['Status'], amountFen=deal['RealTotalCost'], months=1, withinBudget=True, paymentRequested=pay, orderIdLogged=False)
    state['deals'] = deals
    if pay and deal['Status'] == 1:
        request = models.PayDealsRequest()
        request.from_json_string(json.dumps({'OrderIds': [order_id], 'AutoVoucher': 0, 'AgentPay': 0}))
        try:
            payment = json.loads(client.PayDeals(request).to_json_string())
        except Exception as error:
            summary = safe_error(error)
            state['paymentFailure'] = {'code': summary['code'], 'paid': False, 'amountFen': 1990}
            PENDING_ORDER.write_text(json.dumps(state), encoding='utf8')
            emit('approvedPurchasePayment', paid=False, amountFen=1990, months=1, **summary)
            raise
        if order_id not in (payment.get('OrderIds') or []):
            raise ValueError('Payment did not confirm the known order')
        state['payment'] = payment
        emit('approvedPurchasePayment', paid=True, amountFen=1990, months=1, requestId=payment.get('RequestId'))
    elif pay:
        emit('approvedPurchasePayment', paid=deal['Status'] in (2, 3, 4), paymentRepeated=False, state=deal['Status'])
    # Paid metadata grants only the environment belonging to this exact receipt.
    ids = (state.get('payment') or {}).get('ResourceIds') or (deal.get('ResourceId') if deal.get('Status') in (2, 3, 4) else []) or []
    if len(ids) == 1 and isinstance(ids[0], str) and ids[0]:
        state['verifiedPaidResourceIds'] = ids
        PAID_ENVIRONMENT.write_text(json.dumps({'envId': ids[0], 'alias': 'paw-diary-prod', 'amountFen': 1990, 'months': 1, 'cloudEnabled': False}, indent=2) + '\n', encoding='utf8')
        emit('paidEnvironmentReceipt', envId=ids[0], amountFen=1990, months=1, configNotYetValidated=True)
    PENDING_ORDER.write_text(json.dumps(state), encoding='utf8')
    return {'paid': deal['Status'] in (2, 3, 4) or bool(state.get('payment')), 'envId': ids[0] if len(ids) == 1 else None}


class Operator:
    def __init__(self, env_id):
        paid_id = authorized_paid_environment()
        if env_id not in (ENV_ID, paid_id):
            raise ValueError('Only the dedicated project environments are allowed')
        self.env_id = env_id
        self.package_id = None if env_id == ENV_ID else 'baas_personal'
        from tencentcloud.common import credential
        from tencentcloud.tcb.v20180608 import tcb_client, models
        from tencentcloud.scf.v20180416 import scf_client, models as scf_models
        cred = credential.Credential(os.environ['TENCENTCLOUD_FUJI_SECRET_ID'], os.environ['TENCENTCLOUD_FUJI_SECRET_KEY'])
        self.tcb, self.scf = tcb_client.TcbClient(cred, REGION), scf_client.ScfClient(cred, REGION)
        self.models, self.scf_models = models, scf_models
        self.failures = []

    def call(self, action, params=None, service='tcb'):
        params = dict(params or {})
        if service == 'tcb':
            if params.get('EnvId', self.env_id) != self.env_id:
                raise ValueError('Cross-environment request rejected')
            params['EnvId'] = self.env_id
            client, models = self.tcb, self.models
        else:
            if params.get('Namespace', self.env_id) != self.env_id:
                raise ValueError('Cross-namespace request rejected')
            params['Namespace'] = self.env_id
            client, models = self.scf, self.scf_models
        request = getattr(models, action + 'Request')()
        request.from_json_string(json.dumps(params))
        result = json.loads(getattr(client, action)(request).to_json_string())
        emit(action, ok=True, requestId=result.get('RequestId'), resource=params.get('TableName') or params.get('Resource') or params.get('FunctionName'))
        return result

    def attempt(self, action, params=None, service='tcb'):
        try:
            return self.call(action, params, service)
        except Exception as error:
            summary = safe_error(error)
            self.failures.append({'action': action, **summary})
            emit(action, ok=False, **summary)
            return None

    def storage_acl(self, bucket, write=False):
        # Manager Node SDK 5.9.0 uses these Cloud APIs; they are absent from the
        # Python generated models. Keep the raw action and fields constrained.
        action = 'ModifyStorageSafeRule' if write else 'DescribeStorageSafeRule'
        params = {'EnvId': self.env_id, 'Bucket': bucket}
        if write:
            params.update({'AclTag': 'CUSTOM', 'Rule': DENY_RULE})
        try:
            result = json.loads(self.tcb.call(action, params))['Response']
            if 'Error' in result:
                raise RuntimeError('Cloud API returned an error')
            emit(action, ok=True, requestId=result.get('RequestId'), resource=bucket,
                 **({} if write else {'acl': result.get('AclTag'), 'rule': result.get('Rule')}))
            return result
        except Exception as error:
            summary = safe_error(error)
            self.failures.append({'action': action, **summary})
            emit(action, ok=False, **summary)
            return None

    def environment(self):
        result = self.call('DescribeEnvs')
        environments = result.get('EnvList', [])
        if len(environments) != 1 or environments[0].get('EnvId') != self.env_id:
            raise ValueError('Dedicated environment not found')
        env = environments[0]
        allowed_packages = ('baas_trial', 'baas_personal') if self.env_id == ENV_ID else ('baas_personal',)
        if env.get('Region') != REGION or env.get('PackageId') not in allowed_packages or env.get('Status') != 'NORMAL':
            raise ValueError('Environment package or region changed unexpectedly')
        self.package_id = env['PackageId']
        databases = env.get('Databases') or []
        postgres = env.get('PostgreSQL') or []
        if not isinstance(databases, list) or len(databases) != 1 or not isinstance(postgres, list) or postgres:
            raise ValueError('Exactly one document database and no PostgreSQL resource are required')
        if self.env_id != ENV_ID and env.get('Alias') != 'paw-diary-prod':
            raise ValueError('Paid project alias mismatch')
        billing = self.call('DescribeBillingInfo')
        if billing:
            for info in billing.get('EnvBillingInfoList') or []:
                if info.get('EnvId') == self.env_id:
                    emit('environmentBilling', **{key: info.get(key) for key in ('EnvId', 'PackageId', 'Status', 'ExpireTime', 'IsAutoRenew', 'EnableOverrun')})
                    if info.get('IsAutoRenew') is not False or info.get('EnableOverrun') is not False:
                        raise ValueError('Automatic renewal or overrun must be disabled')
        emit('environment', envId=self.env_id, region=REGION, packageId=env['PackageId'], status=env['Status'], databaseCount=len(env.get('Databases') or []), storageCount=len(env.get('Storages') or []))
        return env

    def disable_overrun(self):
        # Root explicitly authorized closing overrun only on the user-upgraded original environment.
        if self.env_id != ENV_ID:
            raise ValueError('Only the original project environment may close overrun')
        environments = self.call('DescribeEnvs').get('EnvList') or []
        if len(environments) != 1:
            raise ValueError('Dedicated environment not found')
        env = environments[0]
        if env.get('EnvId') != ENV_ID or env.get('PackageId') != 'baas_personal' or env.get('Region') != REGION or env.get('Status') != 'NORMAL' or len(env.get('Databases') or []) != 1 or env.get('PostgreSQL'):
            raise ValueError('Personal document database environment required before closing overrun')
        billing = self.call('DescribeBillingInfo').get('EnvBillingInfoList') or []
        info = next((item for item in billing if item.get('EnvId') == ENV_ID), None)
        if not info or info.get('IsAutoRenew') is not False:
            raise ValueError('Automatic renewal must already be disabled')
        if info.get('EnableOverrun') is not False:
            self.call('ModifyEnvExtra', {'EnableOverrun': 'FALSE'})
        self.environment()
        emit('overrunDisabledVerified', envId=self.env_id, automaticRenewal=False, overrun=False, purchaseRequested=False)

    def anonymous_window(self):
        # One explicitly authorized technical SDK session; a hard deadline restores even if capture fails.
        self.environment()
        if self.env_id != ENV_ID or self.package_id != 'baas_personal':
            raise ValueError('Temporary anonymous window is limited to the approved original personal environment')
        keys = ('EmailLogin', 'UserNameLogin', 'PhoneNumberLogin', 'AnonymousLogin')
        original = self.call('DescribeLoginConfig')
        original = {key: original.get(key) for key in keys}
        if original != {'EmailLogin': True, 'UserNameLogin': False, 'PhoneNumberLogin': False, 'AnonymousLogin': False}:
            raise ValueError('Email-only baseline required before temporary anonymous window')
        stop = ROOT / 'test-results/stage2/anonymous-window-stop'
        stop.unlink(missing_ok=True)
        try:
            self.call('ModifyLoginConfig', {**original, 'AnonymousLogin': True})
            enabled = self.call('DescribeLoginConfig')
            if any(enabled.get(key) != (True if key == 'AnonymousLogin' else value) for key, value in original.items()):
                raise RuntimeError('Temporary anonymous flags did not match the authorized window')
            emit('anonymousWindow', envId=self.env_id, enabled=True, maximumSeconds=45, emailUnchanged=True, phoneDisabled=True, usernameDisabled=True)
            deadline = time.monotonic() + 45
            while time.monotonic() < deadline and not stop.exists():
                time.sleep(0.5)
        finally:
            self.call('ModifyLoginConfig', original)
            restored = self.call('DescribeLoginConfig')
            if any(restored.get(key) != value for key, value in original.items()):
                raise RuntimeError('Temporary anonymous window restore did not persist')
            emit('anonymousWindowRestored', envId=self.env_id, anonymous=False, email=True, phone=False, username=False, restored=True)
            stop.unlink(missing_ok=True)

    def inspect(self):
        env = self.environment()
        login = self.attempt('DescribeLoginConfig')
        if login:
            emit('login', **{key: login.get(key) for key in ('EmailLogin', 'UserNameLogin', 'PhoneNumberLogin', 'AnonymousLogin')})
        providers = self.attempt('GetProviders')
        if providers:
            emit('providers', providers=[{'id': p.get('Id'), 'type': p.get('ProviderType'), 'on': p.get('On'), 'platformEmailProxyOn': (p.get('EmailConfig') or {}).get('On'), 'autoEmailMatch': p.get('AutoSignInWhenEmailMatch'), 'autoPhoneMatch': p.get('AutoSignInWhenPhoneNumberMatch')} for p in providers.get('Data') or []])
        client = self.attempt('DescribeClient', {'Id': self.env_id})
        if client:
            emit('client', **{key: client.get(key) for key in ('Id', 'MaxDevice', 'AccessTokenExpiresIn', 'RefreshTokenExpiresIn')})
        domains = self.attempt('DescribeAuthDomains')
        if domains:
            emit('domains', domains=[{'domain': d.get('Domain'), 'type': d.get('Type'), 'status': d.get('Status')} for d in domains.get('Domains') or []])
        for database in env.get('Databases') or []:
            tables = self.attempt('DescribeTables', {'Tag': database['InstanceId'], 'TableNames': list(COLLECTIONS), 'MgoLimit': 100, 'MgoOffset': 0})
            if tables:
                emit('collections', names=[t.get('TableName') for t in tables.get('Tables') or []])
        permissions = self.attempt('DescribeResourcePermission', {'ResourceType': 'collection', 'Resources': list(COLLECTIONS)})
        if permissions:
            emit('collectionPermissions', data=permissions.get('Data'))
        for storage in env.get('Storages') or []:
            self.storage_acl(storage['Bucket'])
            permissions = self.attempt('DescribeResourcePermission', {'ResourceType': 'storage', 'Resources': [storage['Bucket']]})
            if permissions:
                emit('storagePermissions', data=permissions.get('Data'))
        permissions = self.attempt('DescribeResourcePermission', {'ResourceType': 'function'})
        if permissions:
            emit('functionPermissions', data=permissions.get('Data'))
        keys = self.attempt('DescribeApiKeyList', {'KeyType': 'publish_key', 'PageNumber': 1, 'PageSize': 10})
        if keys:
            emit('publishKeyMetadata', total=keys.get('Total'), keys=[{'name': k.get('Name'), 'createdAt': k.get('CreateAt'), 'expiresAt': k.get('ExpireAt'), 'present': bool(k.get('ApiKey'))} for k in keys.get('Data') or []])
        for name in FUNCTIONS:
            status = self.attempt('GetFunction', {'FunctionName': name, 'ShowCode': 'FALSE'}, service='scf')
            if status:
                self.function_summary(status)

    def configure(self):
        env = self.environment()
        self.attempt('ModifyLoginConfig', {'EmailLogin': True, 'UserNameLogin': False, 'PhoneNumberLogin': False, 'AnonymousLogin': False})
        self.attempt('ModifyProvider', {'Id': 'email', 'On': 'TRUE', 'EmailConfig': {'On': 'TRUE'}, 'AutoSignInWhenEmailMatch': 'FALSE', 'AutoSignInWhenPhoneNumberMatch': 'FALSE'})
        # A five-device session limit permits the planned cross-browser tests.
        self.attempt('ModifyClient', {'Id': self.env_id, 'MaxDevice': 5})
        domains = self.call('DescribeAuthDomains').get('Domains') or []
        required_domains = DOMAINS if self.package_id == 'baas_trial' else (*DOMAINS, *ACCEPTANCE_DOMAINS)
        missing = [d for d in required_domains if not any(x.get('Domain') == d and x.get('Status') == 'ENABLE' for x in domains)]
        if missing:
            self.attempt('CreateAuthDomain', {'Domains': missing})
        # Never remove platform/default domains as part of a retry.
        databases = env.get('Databases') or []
        if len(databases) != 1:
            raise ValueError('Expected exactly one document database; refusing resource creation')
        tag = databases[0]['InstanceId']
        existing = self.call('DescribeTables', {'Tag': tag, 'TableNames': list(COLLECTIONS), 'MgoLimit': 100, 'MgoOffset': 0}).get('Tables') or []
        names = {t.get('TableName') for t in existing}
        for name in COLLECTIONS:
            if name not in names:
                self.attempt('CreateTable', {'Tag': tag, 'TableName': name, 'PermissionInfo': {'EnvId': self.env_id, 'AclTag': 'ADMINONLY'}})
            self.attempt('ModifyResourcePermission', {'ResourceType': 'collection', 'Resource': name, 'Permission': 'CUSTOM', 'SecurityRule': DENY_RULE})
        for storage in env.get('Storages') or []:
            self.storage_acl(storage['Bucket'], write=True)
            self.storage_acl(storage['Bucket'])
        self.attempt('ModifyResourcePermission', {'ResourceType': 'function', 'Permission': 'CUSTOM', 'SecurityRule': json.dumps({'*': {'invoke': False}, 'paw-api': {'invoke': 'auth!=null'}, 'paw-stage2-readiness': {'invoke': True}})})
        keys = self.attempt('DescribeApiKeyList', {'KeyType': 'publish_key', 'PageNumber': 1, 'PageSize': 10})
        data = (keys or {}).get('Data') or []
        if not data:
            self.attempt('CreateApiKey', {'KeyType': 'publish_key'})
            keys = self.attempt('DescribeApiKeyList', {'KeyType': 'publish_key', 'PageNumber': 1, 'PageSize': 10})
            data = (keys or {}).get('Data') or []
        key = next((item for item in data if item.get('Name') == 'publish_key'), None)
        if key and key.get('Name') == 'publish_key' and key.get('ApiKey'):
            PUBLIC_CONFIG.parent.mkdir(parents=True, exist_ok=True)
            PUBLIC_CONFIG.write_text(json.dumps({'env': self.env_id, 'region': REGION, 'publishableKey': key['ApiKey'], 'keyType': 'publish_key', 'functionName': 'paw-api', 'cloudEnabled': False, 'readinessStatus': 'awaiting-real-private-email-validation'}, indent=2) + '\n', encoding='utf8')
            emit('publicConfigSaved', path=str(PUBLIC_CONFIG.relative_to(ROOT)), keyType='publish_key', keyPresent=True)
        else:
            self.failures.append({'action': 'publicConfig', 'code': 'MissingPublishKey'})
        self.refresh_public_config()
        if self.failures:
            raise RuntimeError('Configuration incomplete; inspect safe API failures in cloud-ops.log')

    def refresh_public_config(self):
        env = self.environment()
        domains = self.call('DescribeAuthDomains').get('Domains') or []
        has_domain = any(d.get('Domain') == DOMAINS[0] and d.get('Status') == 'ENABLE' for d in domains)
        local_ready = self.package_id == 'baas_trial' or all(any(d.get('Domain') == local and d.get('Status') == 'ENABLE' for d in domains) for local in ACCEPTANCE_DOMAINS)
        has_storage_deny = bool(env.get('Storages'))
        for storage in env.get('Storages') or []:
            acl = self.storage_acl(storage['Bucket'])
            try:
                rule = json.loads((acl or {}).get('Rule') or '{}')
            except ValueError:
                rule = {}
            has_storage_deny = has_storage_deny and (acl or {}).get('AclTag') == 'CUSTOM' and rule.get('read') is False and rule.get('write') is False
        keys = self.call('DescribeApiKeyList', {'KeyType': 'publish_key', 'PageNumber': 1, 'PageSize': 10}).get('Data') or []
        key = next((k for k in keys if k.get('Name') == 'publish_key' and k.get('ApiKey')), None)
        if not key:
            raise RuntimeError('No publishable key available')
        reasons = []
        if not has_domain:
            reasons.append('production-domain-not-configured')
        if not local_ready:
            reasons.append('local-acceptance-domains-not-configured')
        if not has_storage_deny:
            reasons.append('private-storage-deny-rule-not-configured')
        login = self.call('DescribeLoginConfig')
        login_ready = login.get('EmailLogin') is True and all(login.get(k) is False for k in ('UserNameLogin', 'PhoneNumberLogin', 'AnonymousLogin'))
        providers = self.call('GetProviders').get('Data') or []
        email = next((p for p in providers if p.get('Id') == 'email'), {})
        provider_ready = email.get('On') == 'TRUE' and (email.get('EmailConfig') or {}).get('On') == 'TRUE' and email.get('AutoSignInWhenEmailMatch') == 'FALSE' and email.get('AutoSignInWhenPhoneNumberMatch') == 'FALSE'
        client_ready = self.call('DescribeClient', {'Id': self.env_id}).get('MaxDevice') == 5
        permissions = (self.call('DescribeResourcePermission', {'ResourceType': 'collection', 'Resources': list(COLLECTIONS)}).get('Data') or {}).get('PermissionList') or []
        private_collections = set()
        for permission in permissions:
            try:
                rule = json.loads(permission.get('SecurityRule') or '{}')
            except ValueError:
                rule = {}
            if permission.get('Permission') == 'CUSTOM' and rule.get('read') is False and rule.get('write') is False:
                private_collections.add(permission.get('Resource'))
        collections_ready = set(COLLECTIONS) <= private_collections
        functions = (self.call('DescribeResourcePermission', {'ResourceType': 'function'}).get('Data') or {}).get('PermissionList') or []
        try:
            function_rules = json.loads(functions[0].get('SecurityRule') or '{}') if functions else {}
        except ValueError:
            function_rules = {}
        functions_ready = function_rules.get('*', {}).get('invoke') is False and function_rules.get('paw-api', {}).get('invoke') == 'auth!=null'
        for ready, reason in ((login_ready and provider_ready, 'email-provider-not-configured'), (client_ready, 'cross-device-limit-not-configured'), (collections_ready, 'private-collection-rules-not-configured'), (functions_ready, 'function-rules-not-configured')):
            if not ready:
                reasons.append(reason)
        setup_ready = has_domain and local_ready and has_storage_deny and login_ready and provider_ready and client_ready and collections_ready and functions_ready
        reasons.append('real-email-and-private-access-not-validated')
        config = {'env': self.env_id, 'region': REGION, 'publishableKey': key['ApiKey'], 'keyType': 'publish_key', 'functionName': 'paw-api', 'cloudEnabled': False, 'platformSetupReady': setup_ready, 'readinessStatus': 'blocked' if len(reasons) > 1 else 'awaiting-real-private-email-validation', 'readinessReasons': reasons}
        PUBLIC_CONFIG.write_text(json.dumps(config, indent=2) + '\n', encoding='utf8')
        emit('publicConfigSaved', cloudEnabled=False, platformSetupReady=config['platformSetupReady'], readinessReasons=reasons, keyType='publish_key', keyPresent=True, path=str(PUBLIC_CONFIG.relative_to(ROOT)))

    @staticmethod
    def function_summary(result):
        emit('functionStatus', **{key: result.get(key) for key in ('FunctionName', 'Status', 'Runtime', 'MemorySize', 'Timeout', 'Namespace', 'FunctionVersion', 'CodeSize', 'ModTime', 'FunctionId')})

    def deploy(self, name, directory):
        self.environment()
        if name not in FUNCTIONS:
            raise ValueError('Only project functions can be deployed')
        required_values = {'TZ': 'Asia/Shanghai', 'PAW_CLOUD_ENV_ID': self.env_id}
        if name == 'paw-api':
            keys = self.call('DescribeApiKeyList', {'KeyType': 'publish_key', 'PageNumber': 1, 'PageSize': 10}).get('Data') or []
            key = next((k for k in keys if k.get('Name') == 'publish_key' and isinstance(k.get('ApiKey'), str) and k['ApiKey']), None)
            if not key:
                raise RuntimeError('Verified publish_key is required before deploying the private API')
            required_values['PAW_CLOUD_PUBLISHABLE_KEY'] = key['ApiKey']
        environment = {'Variables': [{'Key': key, 'Value': value} for key, value in required_values.items()]}
        directory = Path(directory).resolve()
        allowed = (ROOT / 'test-results/stage2/functions').resolve()
        if allowed not in directory.parents or not (directory / 'index.js').is_file():
            raise ValueError('Function bundle must be in the ignored stage2 functions directory')
        stream = io.BytesIO()
        with zipfile.ZipFile(stream, 'w', zipfile.ZIP_DEFLATED) as archive:
            for path in sorted(directory.rglob('*')):
                if path.is_file():
                    archive.write(path, str(path.relative_to(directory)))
        package = stream.getvalue()
        emit('functionBundle', name=name, zipBytes=len(package), sha256=hashlib.sha256(package).hexdigest())
        try:
            existing = self.call('GetFunction', {'FunctionName': name, 'ShowCode': 'FALSE'}, service='scf')
        except Exception as error:
            if not hasattr(error, 'get_code') or not error.get_code().startswith('ResourceNotFound'):
                raise
            existing = None
        if existing:
            result = self.attempt('UpdateFunctionCode', {'FunctionName': name, 'Namespace': self.env_id, 'Handler': 'index.main', 'InstallDependency': 'FALSE', 'Publish': 'FALSE', 'Code': {'ZipFile': base64.b64encode(package).decode('ascii')}, 'CodeSource': 'ZipFile'})
        else:
            result = self.attempt('CreateFunction', {'FunctionName': name, 'Handler': 'index.main', 'MemorySize': 256, 'Timeout': 3, 'Runtime': 'Nodejs18.15', 'InstallDependency': 'FALSE', 'CodeSource': 'ZipFile', 'Code': {'ZipFile': base64.b64encode(package).decode('ascii')}, 'Environment': environment, 'AutoCreateClsTopic': 'FALSE', 'AutoDeployClsTopicIndex': 'FALSE', 'Description': 'Paw diary stage2 private health API' if name == 'paw-api' else 'Temporary stage2 identity flags only readiness probe'})
        if not result:
            raise RuntimeError('Function deployment failed; see safe API summary')
        for _ in range(12):
            status = self.attempt('GetFunction', {'FunctionName': name, 'ShowCode': 'FALSE'}, service='scf')
            if status:
                self.function_summary(status)
                if status.get('Status') == 'Active':
                    variables = (status.get('Environment') or {}).get('Variables') or []
                    values = {v.get('Key'): v.get('Value') for v in variables}
                    if any(values.get(key) != value for key, value in required_values.items()):
                        updated = self.attempt('UpdateFunctionConfiguration', {'FunctionName': name, 'MemorySize': 256, 'Timeout': 3, 'Environment': environment}, service='scf')
                        if not updated:
                            raise RuntimeError('Function public environment configuration failed')
                        time.sleep(2)
                        continue
                    emit('functionEnvironmentVerified', functionName=name, envId=self.env_id, timezone='Asia/Shanghai', publicKeyConfigured=name == 'paw-api', managementSecretsInjected=False)
                    return
                if status.get('Status') in ('CreateFailed', 'UpdateFailed', 'DeployFailed'):
                    raise RuntimeError('Function entered failed state')
            time.sleep(2)
        raise RuntimeError('Function did not become Active within 24 seconds')

    def invoke_readiness(self):
        result = self.call('Invoke', {'FunctionName': 'paw-stage2-readiness', 'InvocationType': 'RequestResponse', 'ClientContext': '{}', 'LogType': 'None'}, service='scf').get('Result') or {}
        raw = result.get('RetMsg') or '{}'
        try:
            returned = json.loads(raw)
        except ValueError:
            returned = {}
        # Values and keys are constrained; never emit arbitrary function logs,
        # token context, UID, email, or backend exception strings.
        flags = {key: value for key, value in returned.items() if isinstance(value, bool)} if isinstance(returned, dict) else {}
        emit('managementReadiness', invokeResult=result.get('InvokeResult'), errorCode=result.get('ErrMsg') if result.get('ErrMsg') in ('', 'Unhandled', 'Handled') else bool(result.get('ErrMsg')), duration=result.get('Duration'), flags=flags, realEmailUserVerified=False)

    def cleanup_readiness(self):
        """Remove only this session's temporary probe, after actual acceptance."""
        self.environment()
        name = 'paw-stage2-readiness'
        try:
            function = self.call('GetFunction', {'FunctionName': name, 'ShowCode': 'FALSE'}, service='scf')
        except Exception as error:
            if not hasattr(error, 'get_code') or not error.get_code().startswith('ResourceNotFound'):
                raise
            function = None
        if function and function.get('Description') != 'Temporary stage2 identity flags only readiness probe':
            raise ValueError('Temporary probe description changed; refusing to delete')
        rules = {'*': {'invoke': False}, 'paw-api': {'invoke': 'auth!=null'}}
        self.call('ModifyResourcePermission', {'ResourceType': 'function', 'Permission': 'CUSTOM', 'SecurityRule': json.dumps(rules)})
        permissions = (self.call('DescribeResourcePermission', {'ResourceType': 'function'}).get('Data') or {}).get('PermissionList') or []
        actual = json.loads(permissions[0].get('SecurityRule') or '{}') if permissions else {}
        if actual != rules:
            raise RuntimeError('Temporary probe access revocation did not persist')
        if function:
            self.call('DeleteFunction', {'FunctionName': name}, service='scf')
        for _ in range(6):
            try:
                self.call('GetFunction', {'FunctionName': name, 'ShowCode': 'FALSE'}, service='scf')
            except Exception as error:
                if hasattr(error, 'get_code') and error.get_code().startswith('ResourceNotFound'):
                    emit('readinessCleanupVerified', envId=self.env_id, temporaryFunctionAbsent=True, publicProbeRuleAbsent=True, privateApiTouched=False)
                    return
                raise
            time.sleep(2)
        raise RuntimeError('Temporary probe deletion not yet confirmed')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--env', default=ENV_ID)
    parser.add_argument('command', choices=('inspect', 'configure', 'deploy', 'invoke-readiness', 'cleanup-readiness', 'guard-check', 'refresh-public-config', 'disable-overrun', 'anonymous-window', 'recheck-paid-pending', 'pay-known-pending'), nargs='?', default='inspect')
    parser.add_argument('--function', choices=FUNCTIONS)
    parser.add_argument('--bundle')
    parser.add_argument('--funds-confirmed-by-root', action='store_true', help='Use only after root explicitly confirms funds are ready; never implied by elapsed time')
    args = parser.parse_args()
    if args.env not in (ENV_ID, authorized_paid_environment()):
        parser.error('Only the dedicated project environments are allowed')
    if args.command == 'guard-check':
        print(json.dumps({'envGuard': True, 'region': REGION, 'collections': list(COLLECTIONS), 'domains': list(DOMAINS), 'noBillingActions': True}))
        return
    if args.command in ('recheck-paid-pending', 'pay-known-pending'):
        if args.command == 'pay-known-pending' and not args.funds_confirmed_by_root:
            parser.error('Payment requires an explicit later root funds confirmation')
        recheck_paid_pending(pay=args.command == 'pay-known-pending', funds_confirmed_by_root=args.funds_confirmed_by_root)
        return
    operator = Operator(args.env)
    if args.command == 'deploy':
        if not args.function or not args.bundle:
            parser.error('deploy requires --function and --bundle')
        operator.deploy(args.function, args.bundle)
    elif args.command == 'refresh-public-config':
        operator.refresh_public_config()
    elif args.command == 'invoke-readiness':
        operator.invoke_readiness()
    elif args.command == 'cleanup-readiness':
        operator.cleanup_readiness()
    else:
        getattr(operator, args.command.replace('-', '_'))()


if __name__ == '__main__':
    try:
        main()
    except Exception as error:
        emit('operatorFailure', ok=False, **safe_error(error))
        sys.exit(1)
