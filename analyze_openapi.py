import json

def analyze():
    with open('openapi.json', 'r') as f:
        data = json.load(f)

    schemas = data.get('components', {}).get('schemas', {})
    print("SCHEMAS:")
    for name, schema in schemas.items():
        print(f"  {name}")
        props = schema.get('properties', {})
        for p_name, p_details in props.items():
            print(f"    - {p_name}: {p_details.get('type')} {p_details.get('format', '')}")

    print("\nPATHS:")
    paths = data.get('paths', {})
    for path, methods in paths.items():
        for method, details in methods.items():
            print(f"{method.upper()} {path}")
            # print request body schema
            req_body = details.get('requestBody', {})
            if req_body:
                content = req_body.get('content', {}).get('application/json', {}).get('schema', {})
                if '$ref' in content:
                    print(f"  Req: {content['$ref']}")
            # print response schemas
            responses = details.get('responses', {})
            for code, resp in responses.items():
                content = resp.get('content', {}).get('application/json', {}).get('schema', {})
                if '$ref' in content:
                    print(f"  Resp {code}: {content['$ref']}")
                elif 'items' in content and '$ref' in content['items']:
                    print(f"  Resp {code}: Array of {content['items']['$ref']}")

if __name__ == "__main__":
    analyze()
