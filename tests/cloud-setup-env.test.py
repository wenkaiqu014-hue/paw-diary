import importlib.util
from pathlib import Path
import unittest

spec=importlib.util.spec_from_file_location('paw_setup',Path(__file__).resolve().parents[1]/'scripts/cloud-setup.py')
module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)

class EnvironmentMerge(unittest.TestCase):
 def test_preserves_existing_ai_lbs_and_overrides_only_managed_values(self):
  old=[{'Key':'TEXT_AI_API_KEY','Value':'synthetic-ai'},{'Key':'PAW_LBS_KEY','Value':'synthetic-lbs'},{'Key':'UNRELATED','Value':'keep'},{'Key':'PAW_BETA_GATE_ENABLED','Value':'false'}]
  merged=module.merge_function_environment(old,{'PAW_BETA_GATE_ENABLED':'true'})
  self.assertEqual(merged,{'TEXT_AI_API_KEY':'synthetic-ai','PAW_LBS_KEY':'synthetic-lbs','UNRELATED':'keep','PAW_BETA_GATE_ENABLED':'true'})
  self.assertEqual(old[3]['Value'],'false')
 def test_explicit_exclusion_keeps_invite_secret_only_in_auth(self):
  merged=module.merge_function_environment([{'Key':'PAW_BETA_INVITE_CODE','Value':'001234'},{'Key':'OTHER','Value':'keep'}],{'PAW_BETA_GATE_ENABLED':'true'},exclude_keys={'PAW_BETA_INVITE_CODE'})
  self.assertNotIn('PAW_BETA_INVITE_CODE',merged);self.assertEqual(merged['OTHER'],'keep')
 def test_rejects_duplicate_and_nonstring_environment_entries(self):
  for old in [[{'Key':'X','Value':1}],[{'Key':'X','Value':'a'},{'Key':'X','Value':'b'}]]:
   with self.assertRaises(ValueError):module.merge_function_environment(old,{})
 def test_rejects_management_credential_injection(self):
  with self.assertRaises(ValueError):module.merge_function_environment([] ,{'TENCENTCLOUD_FUJI_SECRET_KEY':'synthetic-manager'})

if __name__=='__main__':unittest.main()
