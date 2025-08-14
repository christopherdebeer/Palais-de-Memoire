# Image Generation API - Usage Guide

This API provides AI-powered image generation using Replicate's Flux model. It supports both authenticated access with the service's built-in token and user-provided Replicate API tokens.

## Base URL
```
https://your-val-town-url.web.val.run
```

## Authentication Methods

### Method 1: Service Authentication (Default)
Use the service's built-in Replicate token by providing the service's AUTH_TOKEN:

```bash
curl -H "Authorization: Bearer YOUR_SERVICE_AUTH_TOKEN" \
     "https://your-val-town-url.web.val.run/generate?prompt=a%20beautiful%20sunset"
```

### Method 2: User-Provided Token (New Feature)
Provide your own Replicate API token to bypass service authentication. This allows you to use your own Replicate credits and quotas without needing the service's AUTH_TOKEN.

**Key Benefits:**
- No need for service authentication
- Use your own Replicate credits and limits
- Direct control over API usage
- Bypass service rate limits

## API Endpoints

### 1. Generate Image (GET)
Generate an image and redirect to the image URL.

**Endpoint:** `GET /generate`

**Parameters:**
- `prompt` (required): Text description of the image to generate
- `replicate_token` (optional): Your Replicate API token

**Authentication Options:**
- **With service token:** Include `Authorization: Bearer YOUR_SERVICE_AUTH_TOKEN` header
- **With user token:** Include `replicate_token` parameter (no Authorization header needed)

**Examples:**

Using service authentication:
```bash
curl -H "Authorization: Bearer YOUR_SERVICE_AUTH_TOKEN" \
     "https://your-val-town-url.web.val.run/generate?prompt=a%20cat%20wearing%20sunglasses"
```

Using your own Replicate token:
```bash
curl "https://your-val-town-url.web.val.run/generate?prompt=a%20cat%20wearing%20sunglasses&replicate_token=r8_YOUR_REPLICATE_TOKEN"
```

**Response:** 
- Status: 302 (Redirect)
- Location header contains the generated image URL

### 2. Generate Image (POST)
Generate an image and return JSON with image details. Supports both simple prompt format and full Replicate API control.

**Endpoint:** `POST /generate`

**Request Body Options:**

**Option 1: Simple Format (Backward Compatible)**
```json
{
  "prompt": "a beautiful landscape",
  "replicate_token": "r8_YOUR_REPLICATE_TOKEN" // optional
}
```

**Option 2: Full Replicate API Control (New Feature)**
```json
{
  "input": {
    "prompt": "a beautiful landscape",
    "output_format": "png",
    "aspect_ratio": "16:9",
    "num_outputs": 1,
    "guidance_scale": 3.5,
    "num_inference_steps": 4,
    "seed": 12345
  },
  "replicate_token": "r8_YOUR_REPLICATE_TOKEN" // optional
}
```

**Option 3: Full Replicate API with Additional Parameters**
```json
{
  "input": {
    "prompt": "a beautiful landscape",
    "output_format": "webp",
    "aspect_ratio": "1:1"
  },
  "webhook": "https://your-webhook-url.com/callback",
  "webhook_events_filter": ["start", "completed"],
  "replicate_token": "r8_YOUR_REPLICATE_TOKEN" // optional
}
```

**Authentication Options:**
- **With service token:** Include `Authorization: Bearer YOUR_SERVICE_AUTH_TOKEN` header
- **With user token:** Include `replicate_token` in request body (no Authorization header needed)
- **With user token (header):** Include `X-Replicate-Token: r8_YOUR_REPLICATE_TOKEN` header

**Examples:**

Using service authentication (simple format):
```bash
curl -X POST \
     -H "Authorization: Bearer YOUR_SERVICE_AUTH_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{"prompt": "a futuristic city"}' \
     https://your-val-town-url.web.val.run/generate
```

Using your own Replicate token (simple format):
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{"prompt": "a futuristic city", "replicate_token": "r8_YOUR_REPLICATE_TOKEN"}' \
     https://your-val-town-url.web.val.run/generate
```

Using full Replicate API control:
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -d '{
       "input": {
         "prompt": "a futuristic city at sunset",
         "aspect_ratio": "16:9",
         "output_format": "png",
         "guidance_scale": 3.5,
         "num_inference_steps": 8,
         "seed": 42
       },
       "replicate_token": "r8_YOUR_REPLICATE_TOKEN"
     }' \
     https://your-val-town-url.web.val.run/generate
```

Using your own Replicate token (in header):
```bash
curl -X POST \
     -H "Content-Type: application/json" \
     -H "X-Replicate-Token: r8_YOUR_REPLICATE_TOKEN" \
     -d '{
       "input": {
         "prompt": "a futuristic city",
         "aspect_ratio": "1:1",
         "output_format": "webp"
       }
     }' \
     https://your-val-town-url.web.val.run/generate
```

**Response:**
```json
{
  "id": "generated_image_1234567890.png",
  "imageUrl": "https://your-val-town-url.web.val.run/image/generated_image_1234567890.png"
}
```

### 3. Retrieve Image
Get a previously generated image.

**Endpoint:** `GET /image/{imageId}`

**Parameters:**
- `imageId`: The image ID returned from the generate endpoint

**Authentication:** None required for image retrieval

**Example:**
```bash
curl https://your-val-town-url.web.val.run/image/generated_image_1234567890.png
```

**Response:** 
- Content-Type: image/png
- Binary image data

## Token Priority

When multiple token sources are provided, the API uses this priority order:

1. `X-Replicate-Token` header
2. `replicate_token` in request body (POST only)
3. `replicate_token` query parameter (GET only)
4. Service's built-in `REPLICATE_API_TOKEN` (default)

## Error Responses

### 400 Bad Request
```json
{
  "error": "Missing 'prompt' query parameter"
}
```

### 401 Unauthorized
```
Unauthorized access 🚫
```

### 404 Not Found
```
Not Found
```
or
```
Image not found
```

### 500 Internal Server Error
```json
{
  "error": "Failed to generate image",
  "details": "Specific error message"
}
```

## Getting a Replicate API Token

1. Sign up at [replicate.com](https://replicate.com)
2. Go to your account settings
3. Generate an API token
4. The token will start with `r8_`

## Use Cases

### For Service Owners
- Use the built-in authentication to control access
- Monitor usage through your service logs
- Manage costs through your Replicate account

### For End Users
- Use your own Replicate token to:
  - Avoid service rate limits
  - Use your own Replicate credits
  - Have direct control over API usage
  - Bypass service authentication requirements

## Rate Limits

Rate limits depend on the Replicate token being used:
- **Service token:** Subject to the service owner's Replicate plan
- **User token:** Subject to your own Replicate plan and limits

## Flux Model Parameters

When using the full API control format, you can specify any parameters supported by the `black-forest-labs/flux-schnell` model:

### Common Parameters:
- **`prompt`** (required): Text description of the image
- **`aspect_ratio`**: Image dimensions (e.g., "1:1", "16:9", "9:16", "4:3", "3:4")
- **`output_format`**: Image format ("png", "webp", "jpg")
- **`guidance_scale`**: How closely to follow the prompt (1.0-10.0, default: 3.5)
- **`num_inference_steps`**: Quality vs speed tradeoff (1-50, default: 4)
- **`seed`**: Random seed for reproducible results (integer)
- **`num_outputs`**: Number of images to generate (1-4, default: 1)

### Example with All Parameters:
```json
{
  "input": {
    "prompt": "a majestic dragon flying over a medieval castle",
    "aspect_ratio": "16:9",
    "output_format": "png",
    "guidance_scale": 4.0,
    "num_inference_steps": 8,
    "seed": 123456,
    "num_outputs": 1
  }
}
```

### Additional Replicate API Features:
You can also use any top-level Replicate API parameters:
- **`webhook`**: URL to receive completion notifications
- **`webhook_events_filter`**: Which events to send to webhook
- **`stream`**: Enable streaming responses

## Request Format Summary

The API now supports three request formats for POST requests:

1. **Simple Format**: `{"prompt": "text"}` (backward compatible)
2. **Full Input Control**: `{"input": {...}}` (new feature)
3. **Full API Control**: `{"input": {...}, "webhook": "...", ...}` (advanced)

## JavaScript/TypeScript Example

```typescript
// Using service authentication
const response = await fetch('https://your-val-town-url.web.val.run/generate', {
  method: 'POST',
  headers: {
    'Authorization': 'Bearer YOUR_SERVICE_AUTH_TOKEN',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    prompt: 'a magical forest with glowing mushrooms'
  })
});

const result = await response.json();
console.log('Generated image:', result.imageUrl);

// Using your own Replicate token
const responseWithUserToken = await fetch('https://your-val-town-url.web.val.run/generate', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Replicate-Token': 'r8_YOUR_REPLICATE_TOKEN'
  },
  body: JSON.stringify({
    prompt: 'a magical forest with glowing mushrooms'
  })
});

const resultWithUserToken = await responseWithUserToken.json();
console.log('Generated image:', resultWithUserToken.imageUrl);
```

## Python Example

```python
import requests

# Using service authentication
response = requests.post(
    'https://your-val-town-url.web.val.run/generate',
    headers={
        'Authorization': 'Bearer YOUR_SERVICE_AUTH_TOKEN',
        'Content-Type': 'application/json'
    },
    json={
        'prompt': 'a serene mountain landscape'
    }
)

result = response.json()
print(f"Generated image: {result['imageUrl']}")

# Using your own Replicate token
response_with_user_token = requests.post(
    'https://your-val-town-url.web.val.run/generate',
    headers={
        'Content-Type': 'application/json',
        'X-Replicate-Token': 'r8_YOUR_REPLICATE_TOKEN'
    },
    json={
        'prompt': 'a serene mountain landscape'
    }
)

result_with_user_token = response_with_user_token.json()
print(f"Generated image: {result_with_user_token['imageUrl']}")
```

## Security Notes

- Keep your Replicate API tokens secure
- Don't expose tokens in client-side code
- Use environment variables for token storage
- The service stores generated images temporarily in blob storage
- Images are accessible via direct URL without authentication

## Troubleshooting

### Common Issues

1. **"Unauthorized access"**: Check your Authorization header or provide a valid replicate_token
2. **"Missing 'prompt' parameter"**: Ensure you include a prompt in your request
3. **"Replicate API error"**: Check your Replicate token validity and account limits
4. **"Prediction timed out"**: The image generation took too long; try again with a simpler prompt

### Debug Tips

- Check the service logs for detailed error messages
- Verify your Replicate token at replicate.com
- Ensure your prompt is descriptive but not overly complex
- Check your Replicate account for usage limits and billing status

## Summary

The updated image generation API now supports two authentication modes:

1. **Service Authentication**: Use the service's AUTH_TOKEN (existing behavior)
2. **User Token Authentication**: Provide your own Replicate token to bypass service auth (new feature)

### Key Changes Made:

- ✅ Added support for user-provided Replicate tokens via query parameter, header, or request body
- ✅ Authentication bypass when user provides their own token
- ✅ Maintained all existing functionality and behavior
- ✅ Proper error handling for invalid tokens
- ✅ Multiple token input methods for flexibility

### Token Priority Order:
1. `X-Replicate-Token` header (highest priority)
2. `replicate_token` in request body (POST only)
3. `replicate_token` query parameter (GET only)
4. Service's built-in token (fallback)

This implementation allows users to either use the service's authentication system or bring their own Replicate API tokens for direct access.