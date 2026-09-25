#!/usr/bin/env python3
"""Builds open-in-jsfiddle.html from fiddle.html / fiddle.css / fiddle.js (run after editing a pane)."""
import html
import pathlib

here = pathlib.Path(__file__).parent
panes = {name: (here / f'fiddle.{name}').read_text() for name in ('html', 'css', 'js')}

page = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>Open in JSFiddle</title>
<style>
  body {{ font-family: sans-serif; margin: 16px; max-width: 960px; }}
  textarea {{ width: 100%; font: 12px monospace; box-sizing: border-box; }}
  button {{ font-size: 16px; padding: 8px 16px; }}
</style>
</head>
<body>
<h1>Chart.js fill: 'stack' band drop demo</h1>
<p>
  Click the button to open this demo as a new fiddle on JSFiddle, then press <b>Save</b> there to get a
  shareable link. You can also copy the three panes below into a fiddle by hand.
</p>
<form method="post" action="https://jsfiddle.net/api/post/library/pure/" target="_blank">
  <input type="hidden" name="title" value="Chart.js 4.5.1: fill 'stack' bands disappear at the end of an animation">
  <input type="hidden" name="description" value="Stacked area chart (fill: 'stack'). Toggling the representation animates the chart; right when the animation ends, all bands except the first one disappear and come back one by one.">
  <input type="hidden" name="wrap" value="b">
  <p><button type="submit">Open in JSFiddle</button></p>
  <h2>HTML</h2>
  <textarea name="html" rows="16" readonly>{html.escape(panes['html'])}</textarea>
  <h2>CSS</h2>
  <textarea name="css" rows="5" readonly>{html.escape(panes['css'])}</textarea>
  <h2>JavaScript</h2>
  <textarea name="js" rows="40" readonly>{html.escape(panes['js'])}</textarea>
</form>
</body>
</html>
"""
(here / 'open-in-jsfiddle.html').write_text(page)
