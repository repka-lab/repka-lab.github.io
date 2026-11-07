"""Writes a chart page's data script: the JSON from assets/data as window.<NAME>, so the page opens from file://.

python -X utf8 -I chart/build_chart.py assets/data/tech-week-2026-11-06.json chart/tech-week-data.js TECH_WEEK
"""
import json
import sys

source, out, name = sys.argv[1], sys.argv[2], sys.argv[3]
data = json.load(open(source, encoding='utf8'))
text = f'// Built by build_chart.py from {source}; edit that file, not this one.\nwindow.{name} = {json.dumps(data, separators=(",", ":"))};\n'
open(out, 'w', encoding='utf8', newline='\n').write(text)
print(json.dumps({'out': out, 'bytes': len(text.encode('utf8'))}))
