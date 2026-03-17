import * as Plot from "npm:@observablehq/plot";

// Plot departures by education level

export function PlotEducation(data) {
  return Plot.plot({
    title: "Departures by Education Level",
    marginLeft: 160, 
    x: { label: "Number of Departures" },
    y: { 
      label: null,
      sort: { x: "x", reverse: true } 
    },
    color: { legend: false }, 
    marks: [
      Plot.barX(data, Plot.groupY({ x: "count" }, { 
        y: "education_level_bracket", 
        fill: "education_level_bracket",
        tip: true
      })),
      Plot.ruleX([0])
    ]
  });
}