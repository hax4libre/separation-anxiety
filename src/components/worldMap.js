import * as d3 from "npm:d3";
import * as topojson from "npm:topojson-client";
import * as Plot from "npm:@observablehq/plot"; // Bringing Plot back for the legend!

export async function globalSeparationsMap(data, { width = 975, height = 500 } = {}) {
  // 1. Fetch the World Atlas geometry
  const response = await fetch(import.meta.resolve("npm:world-atlas/countries-50m.json"));
  const world = await response.json();
  const countries = topojson.feature(world, world.objects.countries).features;

  // 2. Convert SQL result to Map for lookups
  const globalCountMap = new Map(
    Array.from(data).map(d => [d.country_name, d.total_separations])
  );

  // Calculate the max value for our scale
  const maxVal = d3.max(Array.from(data), d => d.total_separations) || 1;
  const colorScale = d3.scaleSequentialSymlog(d3.interpolateTurbo).domain([0, maxVal]);

  // 3. Create a master container wrapper
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.flexDirection = "column"; 
  container.style.width = "100%";

// 4. Generate the standalone legend using Observable Plot
  const legend = Plot.legend({
    color: {
      type: "symlog",
      scheme: "turbo",
      domain: [0, maxVal],
      label: "Separations",
      unknown: "none"
    }
  });
  
  // Keep the legend centered
  legend.style.alignSelf = "center";
  
  container.appendChild(legend);

  // 5. Setup D3 Scales and Projection
  const projection = d3.geoEqualEarth().fitSize([width, height], {type: "FeatureCollection", features: countries});
  const path = d3.geoPath(projection);

const svg = d3.create("svg")
      .attr("viewBox", [0, 0, width, height])
      .attr("width", width)
      .attr("height", height)
      .attr("style", "max-width: 100%; height: auto; cursor: grab; align-self: center;") 
      .style("background", "transparent");

  const g = svg.append("g");

  g.append("path")
      .datum({type: "Sphere"})
      .attr("fill", "var(--theme-background-alt)")
      .attr("stroke", "var(--theme-foreground-faintest)")
      .attr("d", path);

  g.selectAll("path.country")
    .data(countries)
    .join("path")
      .attr("class", "country")
      .attr("fill", d => {
         const val = globalCountMap.get(d.properties.name.toUpperCase());
         return val ? colorScale(val) : "none";
      })
      .attr("stroke", "var(--theme-background)")
      .attr("stroke-width", 0.25)
      .attr("d", path)
    .append("title") 
      .text(d => {
         const val = globalCountMap.get(d.properties.name.toUpperCase()) || 0;
         return `${d.properties.name}\nSeparations: ${val.toLocaleString()}`;
      });

  // 6. D3 Zoom
  const zoom = d3.zoom()
      .scaleExtent([1, 8]) 
      .translateExtent([[0, 0], [width, height]]) 
      .on("zoom", (event) => {
          g.attr("transform", event.transform);
          g.selectAll("path.country").attr("stroke-width", 0.25 / event.transform.k);
      });

  svg.call(zoom);

  // 7. Append the SVG map to the container and return the whole package
  container.appendChild(svg.node());
  
  return container;
}