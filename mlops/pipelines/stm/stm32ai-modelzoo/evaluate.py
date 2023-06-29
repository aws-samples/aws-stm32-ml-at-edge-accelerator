import sys,os,logging
import json
import argparse
import subprocess
import traceback


if __name__ == "__main__":
    
    module_path = os.path.abspath('audio_event_detection/scripts/evaluate')
    if module_path not in sys.path:
        sys.path.append(module_path)
        
    try:
        subprocess.run(["python", os.path.join(module_path, "evaluate.py")])
        print('Evaluation complete.')

            # A zero exit code causes the job to be marked a Succeeded.
        sys.exit(0)
    except Exception as e:
        # Write out an error file. This will be returned as the failureReason in the
        # DescribeTrainingJob result.
        trc = traceback.format_exc()
        # Printing this causes the exception to be in the training job logs, as well.
        print('Exception during evaluation: ' + str(e) + '\n' + trc, file=sys.stderr)
        # A non-zero exit code causes the training job to be marked as Failed.
        sys.exit(255)