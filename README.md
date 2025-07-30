# map-compare

This project provides a small static website that lets you compare two places of the world side by side. The maps are powered by Leaflet with OpenStreetMap tiles by default but can be switched to satellite imagery. The interface is responsive so it works on both desktop and mobile browsers.

## Usage

Open `index.html` directly in a browser or host the repository with any static hosting solution such as GitHub Pages. The URL keeps the current map positions so copy‑pasting the address bar will restore the same views.
It also stores whether map or satellite tiles are selected.

Each shape has a drag handle at its center so you can move it freely. Shapes keep the same size across both maps and continue to do so even if you zoom before dragging. Once drawn a shape can't be edited, so redraw it if needed.
When a new shape is created on the first map it is automatically duplicated on the second map at that map's current center so both panes show the drawing immediately. Use the trash button in the toolbar to delete individual shapes. The marker tool has been removed, so only polygons, polylines and rectangles can be drawn.
