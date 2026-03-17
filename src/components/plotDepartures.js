import * as Plot from "npm:@observablehq/plot";

// Render plot of departures by month

export function PlotDepartures(data) {
    return Plot.plot({
    x: { 
      type: "time",
      label: "Effective Date" 
    },
    y: { 
      label: "Number of Departures" 
    },
    marks: [
      Plot.rectY(data, Plot.binX({ y: "count" }, { 
        x: "personnel_action_effective_date_yyyymm",
        interval: "month" 
      })),
      Plot.ruleY([0]) 
    ]
  });
}