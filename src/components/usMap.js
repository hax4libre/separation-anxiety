import * as Plot from "npm:@observablehq/plot";
import * as topojson from "npm:topojson-client";

export async function usSeparationsMap(data, { width = 975, height = 610 } = {}) {
  // 1. Fetch the unprojected US Atlas geometry
  const response = await fetch(import.meta.resolve("npm:us-atlas/states-10m.json"));
  const us = await response.json();
  const states = topojson.feature(us, us.objects.states).features;

  // 2. Convert the passed SQL result into a JavaScript Map for O(1) lookups
  const countMap = new Map(
    Array.from(data).map(d => [d.fips_id, d.total_separations])
  );

  // 3. Return the generated Plot element
  return Plot.plot({
    projection: "albers-usa",
    width,
    height,
    color: {
      type: "sqrt",
      scheme: "blues",
      legend: true,
      label: "Total Separations",
      tickFormat: "s" 
    },
    marks: [
      Plot.geo(states, {
        fill: (d) => countMap.get(d.id) || 0,
        stroke: "var(--theme-background)",
        strokeWidth: 0.5,
        title: (d) => `${d.properties.name}\nSeparations: ${(countMap.get(d.id) || 0).toLocaleString()}`,
        tip: true
      }),
      Plot.geo(topojson.mesh(us, us.objects.states, (a, b) => a !== b), {
        fill: "none",
        stroke: "var(--theme-foreground-faintest)",
        strokeWidth: 0.5
      })
    ]
  });
}