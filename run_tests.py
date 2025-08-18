#!/usr/bin/env python3
"""
Test runner script for the network monitoring backend
"""

import sys
import subprocess
import os
from pathlib import Path

# Add the project root to the Python path
project_root = Path(__file__).resolve().parent
sys.path.insert(0, str(project_root))


def run_tests():
    """Run the test suite"""
    print("🧪 Running Network Monitoring Backend Tests")
    print("=" * 50)
    
    # Set test environment variables
    os.environ["DATABASE_URL"] = "sqlite:///./test.db"
    os.environ["SECRET_KEY"] = "test-secret-key"
    os.environ["FIREBASE_CREDENTIALS_PATH"] = ""  # Disable Firebase for tests
    os.environ["JIRA_BASE_URL"] = ""  # Disable JIRA for tests
    
    try:
        # Run pytest with coverage
        cmd = [
            sys.executable, "-m", "pytest",
            "tests/",
            "-v",
            "--tb=short",
            "--color=yes"
        ]
        
        result = subprocess.run(cmd, cwd=project_root)
        
        if result.returncode == 0:
            print("\n✅ All tests passed!")
        else:
            print("\n❌ Some tests failed!")
            
        return result.returncode
        
    except KeyboardInterrupt:
        print("\n⏹️  Tests interrupted by user")
        return 1
    except Exception as e:
        print(f"\n💥 Error running tests: {e}")
        return 1


def run_specific_test(test_path):
    """Run a specific test file or test function"""
    print(f"🧪 Running specific test: {test_path}")
    print("=" * 50)
    
    # Set test environment variables
    os.environ["DATABASE_URL"] = "sqlite:///./test.db"
    os.environ["SECRET_KEY"] = "test-secret-key"
    os.environ["FIREBASE_CREDENTIALS_PATH"] = ""
    os.environ["JIRA_BASE_URL"] = ""
    
    try:
        cmd = [
            sys.executable, "-m", "pytest",
            test_path,
            "-v",
            "--tb=short",
            "--color=yes"
        ]
        
        result = subprocess.run(cmd, cwd=project_root)
        return result.returncode
        
    except Exception as e:
        print(f"💥 Error running test: {e}")
        return 1


if __name__ == "__main__":
    if len(sys.argv) > 1:
        # Run specific test
        test_path = sys.argv[1]
        exit_code = run_specific_test(test_path)
    else:
        # Run all tests
        exit_code = run_tests()
    
    sys.exit(exit_code)