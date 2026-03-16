---
theme: dashboard
title: Separation Anxiety
toc: false
---

```js
// Connect to single parquet file
const data = await FileAttachment("./data/opm_data.parquet").parquet();

// Render loader data as a table
display(Inputs.table(data, {
    format: {
        personnel_action_effective_date_yyyymm: (x) => new Date(x).toISOString().slice(0, 7),
        appointment_not_to_exceed_date: (x) => new Date(x).toISOString().slice(0, 10),
        service_computation_date_leave: (x) => new Date(x).toISOString().slice(0, 10)
    }
})
);

// Render loader chart
display(
  Plot.plot({
    x: { 
      type: "time",
      label: "Effective Date" 
    },
    y: { 
      label: "Number of Departures" 
    },
    marks: [
      Plot.rectY(data, Plot.binX({ y: "count" }, { 
        x: (d) => new Date(d.personnel_action_effective_date_yyyymm),
        // 2. ADD INTERVAL HERE for monthly bars
        interval: "month" 
      })),
      Plot.ruleY([0]) 
    ]
  })
);

// Render Reasons for Separation Chart
display(
  Plot.plot({
    title: "Top Reasons for Separation",
    marginLeft: 220, // Give plenty of room for the category labels
    x: { label: "Number of Departures" },
    y: { 
      label: null, 
      sort: { x: "x", reverse: true } // Sort bars from largest to smallest
    },
    marks: [
      Plot.barX(data, Plot.groupY({ x: "count" }, { 
        y: "separation_category", 
        fill: "steelblue",
        tip: true // Adds interactive tooltips on hover
      })),
      Plot.ruleX([0])
    ]
  })
);

// Render Length of Service vs Pay Chart
// TODO: Length of service is sometimes incorrect in the raw data. Add a check to determine when length of service exceeds the difference of sevice computation date and personnel action date and adjust accordingly.
display(
  Plot.plot({
    title: "Length of Service vs. Final Pay",
    x: { label: "Length of Service (Years)" },
    y: { 
      label: "Annualized Adjusted Basic Pay ($)", 
      tickFormat: "s" 
    },
    color: { 
      legend: true, 
      domain: ["QUIT", "RETIREMENT - VOLUNTARY", "TRANSFER TO ANOTHER AGENCY"] // Focus colors on main reasons, others will be gray
    },
    marks: [
      Plot.dot(data, { 
        // Inline casting to avoid the BigInt TypeError
        x: (d) => Number(d.length_of_service_years), 
        y: (d) => Number(d.annualized_adjusted_basic_pay), 
        fill: "separation_category", 
        fillOpacity: 0.6,
        tip: true 
      }),
      // Optional: Add a subtle trend line
      Plot.linearRegressionY(data, {
        x: (d) => Number(d.length_of_service_years), 
        y: (d) => Number(d.annualized_adjusted_basic_pay), 
        stroke: "currentColor",
        strokeOpacity: 0.3
      })
    ]
  })
);

// Render Demographics Chart
display(
  Plot.plot({
    title: "Departures by Age Bracket",
    x: { label: "Age Bracket" },
    y: { label: "Number of Departures" },
    marks: [
      Plot.barY(data, Plot.groupX({ y: "count" }, { 
        x: "age_bracket", 
        fill: "#e28743", // Distinct color from the other charts
        tip: true
      })),
      Plot.ruleY([0])
    ]
  })
);

// Render Education Level Bar Chart
display(
  Plot.plot({
    title: "Departures by Education Level",
    marginLeft: 160, // Provides room for the education level labels
    x: { label: "Number of Departures" },
    y: { 
      label: null,
      sort: { x: "x", reverse: true } // Sorts from most to least frequent
    },
    color: { legend: false }, // We don't need a legend since the y-axis has labels
    marks: [
      Plot.barX(data, Plot.groupY({ x: "count" }, { 
        y: "education_level_bracket", 
        fill: "education_level_bracket",
        tip: true
      })),
      Plot.ruleX([0])
    ]
  })
);

```