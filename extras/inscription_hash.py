import hashlib
import requests

def get_inscription_hash(inscription_id):
    """
    Get the SHA-256 hash of a Bitcoin inscription's content.
    
    Args:
        inscription_id: The full inscription ID (with 'i0' suffix)
    
    Returns:
        The SHA-256 hash of the content as a hex string
    """
    # Try multiple ordinals content endpoints
    endpoints = [
        f"https://ordinals.com/content/{inscription_id}",
        f"https://ord.io/content/{inscription_id}",
        f"https://ordiscan.com/content/{inscription_id}"
    ]
    
    for url in endpoints:
        try:
            print(f"Trying: {url}")
            response = requests.get(url, timeout=30)
            
            if response.status_code == 200:
                # Get the raw content bytes
                content = response.content
                
                # Calculate SHA-256 hash
                hash_value = hashlib.sha256(content).hexdigest()
                
                print(f"\nSuccess!")
                print(f"Content length: {len(content)} bytes")
                print(f"Content type: {response.headers.get('content-type', 'unknown')}")
                print(f"SHA-256 Hash: {hash_value}")
                
                return hash_value
            else:
                print(f"  Status code: {response.status_code}")
                
        except Exception as e:
            print(f"  Error: {e}")
            continue
    
    print("\nFailed to retrieve content from all endpoints.")
    return None

# Your inscription ID
inscription_id = "87e11177b0e184cd7ef0f076fc4de5ddacf509b71d2b1937a01b351965567998i0"

hash_result = get_inscription_hash(inscription_id)