import * as Plot from "npm:@observablehq/plot";

// Render plot of length of service vs. final pay

export function PlotPay(data) {
    return Plot.plot({
    title: "Length of Service vs. Final Pay",
    x: { label: "Length of Service (Years)" },
    y: { 
      label: "Annualized Adjusted Basic Pay ($)", 
      tickFormat: "s" 
    },
    color: { 
      legend: true, 
      domain: ["QUIT", "RETIREMENT - VOLUNTARY", "TRANSFER TO ANOTHER AGENCY"] 
    },
    marks: [
      Plot.dot(data, { 
        x: "length_of_service_years",
        y: "annualized_adjusted_basic_pay",
        fill: "separation_category", 
        fillOpacity: 0.6,
        tip: true 
      }),
      Plot.linearRegressionY(data, {
        x: "length_of_service_years", 
        y: "annualized_adjusted_basic_pay", 
        stroke: "currentColor",
        strokeOpacity: 0.3
      })
    ]
  });
}