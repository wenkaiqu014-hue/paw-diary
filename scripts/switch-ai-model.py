#!/usr/bin/env python3
"""Switch only paw-ai's model; preserve its existing key and all other settings."""
import argparse
import importlib.util
from pathlib import Path
import sys
import time

spec = importlib.util.spec_from_file_location('paw_setup', Path(__file__).with_name('cloud-setup.py'))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)
LONGCAT = 'meituan-longcat/LongCat-2.0'
QWEN = 'Qwen/Qwen2.5-7B-Instruct'


def switch_model(model=None):
    operator = setup.Operator(setup.ENV_ID)
    current = operator.call('GetFunction', {'FunctionName': 'paw-ai', 'ShowCode': 'FALSE'}, service='scf')
    values = setup.merge_function_environment((current.get('Environment') or {}).get('Variables') or [], {})
    if current.get('Status') != 'Active' or not values.get('TEXT_AI_API_KEY') or not values.get('TEXT_AI_MODEL'):
        raise ValueError('Active paw-ai with an existing API key and model is required')
    before = values['TEXT_AI_MODEL']
    if model is None:
        setup.emit('aiModelStatus', model=before, status=current['Status'], timeout=current['Timeout'])
        return
    if before == model:
        setup.emit('aiModelSwitchVerified', model=model, changed=False, status='Active')
        return
    values['TEXT_AI_MODEL'] = model
    operator.call('UpdateFunctionConfiguration', {'FunctionName': 'paw-ai', 'Environment': {'Variables': [{'Key': key, 'Value': value} for key, value in values.items()]}}, service='scf')
    for _ in range(30):
        result = operator.call('GetFunction', {'FunctionName': 'paw-ai', 'ShowCode': 'FALSE'}, service='scf')
        if result.get('Status') == 'Active':
            actual = setup.merge_function_environment((result.get('Environment') or {}).get('Variables') or [], {})
            if actual != values or result.get('Timeout') != current.get('Timeout'):
                raise RuntimeError('Configuration readback mismatch; run the documented rollback')
            setup.emit('aiModelSwitchVerified', previousModel=before, model=model, status='Active', timeout=result['Timeout'], otherEnvironmentPreserved=True)
            return
        if result.get('Status') in ('UpdateFailed', 'CreateFailed', 'DeployFailed'):
            raise RuntimeError('Function update failed; run the documented rollback')
        time.sleep(1)
    raise RuntimeError('Function did not become Active; inspect status before retrying')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--model', choices=(LONGCAT, QWEN), help='Omit for read-only status')
    args = parser.parse_args()
    try:
        switch_model(args.model)
    except Exception as error:
        setup.emit('aiModelSwitchFailure', ok=False, **setup.safe_error(error))
        sys.exit(1)
