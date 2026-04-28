import sys
print(f"Python: {sys.version}")
try:
    import fastapi; print(f"fastapi: OK ({fastapi.__version__})")
except Exception as e: print(f"fastapi: FAIL - {e}")
try:
    import uvicorn; print(f"uvicorn: OK")
except Exception as e: print(f"uvicorn: FAIL - {e}")
try:
    import sklearn; print(f"sklearn: OK ({sklearn.__version__})")
except Exception as e: print(f"sklearn: FAIL - {e}")
try:
    import numpy; print(f"numpy: OK ({numpy.__version__})")
except Exception as e: print(f"numpy: FAIL - {e}")
try:
    import pandas; print(f"pandas: OK ({pandas.__version__})")
except Exception as e: print(f"pandas: FAIL - {e}")
try:
    import httpx; print(f"httpx: OK ({httpx.__version__})")
except Exception as e: print(f"httpx: FAIL - {e}")
try:
    import joblib; print(f"joblib: OK")
except Exception as e: print(f"joblib: FAIL - {e}")
try:
    import dotenv; print(f"python-dotenv: OK")
except Exception as e: print(f"dotenv: FAIL - {e}")
print("All checks done.")
