import json
import re

def get_ts_types(ts_file):
    with open(ts_file, 'r') as f:
        content = f.read()

    types = {}

    # regex to find export type Name = { ... }
    matches = re.finditer(r'export\s+type\s+(\w+)\s*=\s*\{([^}]*)\};', content, re.MULTILINE)
    for m in matches:
        name = m.group(1)
        props_str = m.group(2)

        props = {}
        for line in props_str.split('\n'):
            line = line.strip()
            if not line or line.startswith('//'):
                continue

            # handle `prop?: type;` or `prop: type;`
            prop_match = re.match(r'(\w+)(\?)?\s*:\s*([^;]+);', line)
            if prop_match:
                p_name = prop_match.group(1)
                p_optional = bool(prop_match.group(2))
                p_type = prop_match.group(3)
                props[p_name] = {'optional': p_optional, 'type': p_type.strip()}

        types[name] = props

    return types

def compare():
    ts_types = get_ts_types('src/types/index.ts')

    with open('openapi.json', 'r') as f:
        data = json.load(f)

    schemas = data.get('components', {}).get('schemas', {})

    for schema_name, schema in schemas.items():
        if schema_name in ts_types:
            ts_schema = ts_types[schema_name]
            open_props = schema.get('properties', {})

            # Compare properties
            ts_prop_names = set(ts_schema.keys())
            open_prop_names = set(open_props.keys())

            missing_in_ts = open_prop_names - ts_prop_names
            missing_in_open = ts_prop_names - open_prop_names

            if missing_in_ts or missing_in_open:
                print(f"Mismatch in {schema_name}:")
                if missing_in_ts:
                    print(f"  Missing in TS: {missing_in_ts}")
                if missing_in_open:
                    print(f"  Missing in OpenAPI: {missing_in_open}")

compare()
