import * as Plot from "npm:@observablehq/plot";

// Plot Separations by Category

export function PlotCategories(data) {
    return Plot.plot({
    title: "Count Separations by Type",
    marginLeft: 220, 
    x: { label: "Number of Departures" },
    y: { 
      label: null, 
      sort: { x: "x", reverse: true } 
    },
    marks: [
      Plot.barX(data, Plot.groupY({ x: "count" }, { 
        y: "separation_category", 
        fill: "steelblue",
        tip: true 
      })),
      Plot.ruleX([0])
    ]
  });
}