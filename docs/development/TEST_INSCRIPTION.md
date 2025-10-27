# Test Inscription for Auto-Fill Feature

## Inscription Details

**Inscription ID:**
```
87e11177b0e184cd7ef0f076fc4de5ddacf509b71d2b1937a01b351965567998i0
```

**Expected SHA-256 Hash:**
```
9c0ab58ef1739ea5b2d3c3d8bdf962119e1d501107e9196cedeb3def462e3fce
```

**Content Type:** `image/jpeg`  
**File Size:** 75KB (77,185 bytes)

## How to Test

1. Navigate to: `http://localhost:3000/teleburn`

2. In the form, paste the Inscription ID:
   ```
   87e11177b0e184cd7ef0f076fc4de5ddacf509b71d2b1937a01b351965567998i0
   ```

3. Wait approximately 500ms (debounce delay)

4. The SHA-256 field should automatically populate with:
   ```
   9c0ab58ef1739ea5b2d3c3d8bdf962119e1d501107e9196cedeb3def462e3fce
   ```

5. Status message should display:
   ```
   ✓ Auto-filled SHA-256 from inscription (image/jpeg)
   ```

## Verification

You can verify this hash manually:
```bash
# Download inscription
curl -o test.jpg "https://ordinals.com/content/87e11177b0e184cd7ef0f076fc4de5ddacf509b71d2b1937a01b351965567998i0"

# Calculate hash
shasum -a 256 test.jpg
```

Expected output:
```
9c0ab58ef1739ea5b2d3c3d8bdf962119e1d501107e9196cedeb3def462e3fce  test.jpg
```

## Test Scenarios

### ✅ Success Case
- Enter valid inscription ID
- Auto-fill triggers after 500ms
- Hash matches expected value
- Status shows success with content type

### ⚠️ Error Cases to Test
1. **Invalid Inscription ID format**
   - Example: `abc123` (too short)
   - Expected: No auto-fill, format validation error

2. **Non-existent Inscription**
   - Example: `0000000000000000000000000000000000000000000000000000000000000000i0`
   - Expected: "⚠️ Could not fetch inscription content"

3. **Network Error**
   - Disconnect network
   - Expected: "⚠️ Error fetching inscription"

## Notes

- Auto-fill only triggers if SHA-256 field is empty
- User can manually override auto-filled value
- 500ms debounce prevents excessive API calls
- Status messages auto-clear after 3 seconds

---

**Test Passed:** [  ]  
**Date:** ___________  
**Tested By:** ___________

