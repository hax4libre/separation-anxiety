import * as Plot from "npm:@observablehq/plot";
import * as topojson from "npm:topojson-client";

export async function globalSeparationsMap(data, { width = 975, height = 500 } = {}) {
  // 1. Fetch the World Atlas geometry
  const response = await fetch(import.meta.resolve("npm:world-atlas/countries-50m.json"));
  const world = await response.json();
  const countries = topojson.feature(world, world.objects.countries).features;

  // 2. Convert the passed SQL result into a JavaScript Map for O(1) lookups
  const globalCountMap = new Map(
    Array.from(data).map(d => [d.country_name, d.total_separations])
  );

  // 3. Return the generated Plot element
  return Plot.plot({
    projection: "equal-earth",
    width,
    height,
color: {
      type: "symlog",
      scheme: "turbo",
    //   reverse: true,
      legend: true,
      label: "Separations",
      unknown: "none"
    },
    marks: [
      // A faint sphere to outline the globe
      Plot.sphere({ fill: "var(--theme-background-alt)", stroke: "var(--theme-foreground-faintest)" }),
      
      // The country shapes
      Plot.geo(countries, {
        fill: (d) => globalCountMap.get(d.properties.name.toUpperCase()) || 0,
        stroke: "var(--theme-background)",
        strokeWidth: 0.25,
        title: (d) => `${d.properties.name}\nSeparations: ${(globalCountMap.get(d.properties.name.toUpperCase()) || 0).toLocaleString()}`,
        tip: true
      })
    ]
  });
}