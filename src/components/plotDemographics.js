import * as Plot from "npm:@observablehq/plot";

// Plot departures by age bracket

export function PlotDemographics(data) {
  return Plot.plot({
    title: "Departures by Age Bracket",
    x: { label: "Age Bracket" },
    y: { label: "Number of Departures" },
    marks: [
      Plot.barY(data, Plot.groupX({ y: "count" }, { 
        x: "age_bracket", 
        fill: "#e28743", 
        tip: true
      })),
      Plot.ruleY([0])
    ]
  });
}