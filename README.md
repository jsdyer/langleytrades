# Langley Trades

[Open Langley Trades](https://coolcode.ca/langleytrades/) to search the Township of Langley business-licence file by trade, name or street.

<!-- coolcode:guide -->
Type any trade, not only the buttons. A name that is missing from a partial extract is not treated as closed. Phone numbers and streets are only the ones the Township already published.
<!-- /coolcode:guide -->

## Reading a file

The page reads the newest saved capture. A full capture is the whole public licence layer. A partial capture is labelled and is not used to decide that a business closed. Comparison uses the business name, unit, house, street and licence description, not the record number, so a rebuilt file does not look like thousands of new businesses.

The Township directory is updated around the start of each month. Out-of-town licences and rows with no community stay in the list. A dot is drawn only when the file already has a latitude and longitude.

## Source

[Township of Langley business licences](https://data-tol.opendata.arcgis.com/datasets/c80ce8a03364426aa301ca888f149272), Open Government Licence – Township of Langley. No API key. The query is the public feature layer. Home-business streets that the Township publishes are shown as published and are not geocoded further. Streets on the map are [OpenFreeMap](https://openfreemap.org/) Positron, from OpenStreetMap, drawn with MapLibre GL 5.15.0 in `web/vendor/` (BSD-3-Clause).

## Expand or customize

Defaults live in [web/config.json](web/config.json). `query` is the search the page opens with. `trades` are buttons, not a limit: a visitor can type roofing or any other word in the file. `retain` is how many monthly files to keep. `mapStyle` is the street-map style URL.

```sh
python3 scripts/refresh.py
```

That rewrites `web/data/captures/`, `web/data/index.json` and `web/data/status.json`. If the layer returns an error or fewer than 1,000 named licences, the previous file stays. On GitHub, run **Refresh licence file**. The schedule is the 3rd of each month at 15:17 UTC. Pushing ordinary code does not collect a new file.

Publish by enabling **Settings → Pages → GitHub Actions** and pushing to `main`. Check `https://coolcode.ca/langleytrades/`. After it is up, copy `tool.json` into `data/tools.json` in [jsdyer/jsdyer.github.io](https://github.com/jsdyer/jsdyer.github.io) and run `scripts/sync_guides.py --tool langleytrades` there before regenerating the hub README.

```sh
node --test tests/*.test.mjs
python3 -m unittest discover -s tests -v
python3 scripts/build.py
```
