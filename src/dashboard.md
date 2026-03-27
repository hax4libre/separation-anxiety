---
title: OPM Separations Dashboard
theme: dashboard
---

# OPM Separations Data Explorer

Explore the federal workforce dataset. Use the filters below to slice the data dynamically. Additional features will be added over time.

```js
import { usSeparationsMap } from "./components/usMap.js";
import * as d3 from "npm:d3";
```

```js
// 1. Initialize DuckDB with Parquet file
const db = await DuckDBClient.of({ 
  opm: FileAttachment("./data/opm_data.parquet") 
});
```

```js
// 2. Fetch independent filters (Agency and DRP)
const agencyQuery = await db.sql`SELECT DISTINCT agency FROM opm WHERE agency IS NOT NULL ORDER BY agency`;
const agencies = ["All Agencies", ...Array.from(agencyQuery, d => d.agency)];

const agencyInput = Inputs.select(agencies, { label: "Agency:", value: "All Agencies" });
const selectedAgency = Generators.input(agencyInput);

const drpInput = Inputs.radio(["All", "true", "false"], { label: "DRP Indicator:", value: "All" });
const selectedDrp = Generators.input(drpInput);
```

```js
// 3. DEPENDENT FILTER: Fetch subelements based on selected Agency
const subQuery = await db.sql`
  SELECT DISTINCT agency_subelement 
  FROM opm 
  WHERE agency_subelement IS NOT NULL 
    AND (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
  ORDER BY agency_subelement
`;
const subelements = ["All Subelements", ...Array.from(subQuery, d => d.agency_subelement)];

const subelementInput = Inputs.select(subelements, { label: "Subelement:", value: "All Subelements" });
const selectedSub = Generators.input(subelementInput);
```

```js
// 3.5 DEPENDENT FILTER: Fetch occupations based on Agency and Subelement
const occQuery = await db.sql`
  SELECT DISTINCT occupational_series_code, occupational_series 
  FROM opm 
  WHERE occupational_series_code IS NOT NULL 
    AND (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
  ORDER BY occupational_series_code
`;

// Create a Map where Keys = Display Labels, Values = Raw Codes
const occOptions = new Map([
  ["All", "All"],
  ...Array.from(occQuery, d => [
    `${d.occupational_series_code} - ${d.occupational_series ?? "Unknown"}`, 
    d.occupational_series_code
  ])
]);

// Create multi-select input, defaulting to "All"
const occInput = Inputs.select(occOptions, { label: "Occupation:", multiple: true, value: ["All"] });
const selectedOcc = Generators.input(occInput);
```

```js
// Reactive SQL for the US Map (Filters applied)
const mapData = await db.sql`
  SELECT 
    LPAD(TRIM(MODE(duty_station_state_country_territory_code)), 2, '0') AS fips_id,
    duty_station_state AS state_name,
    CAST(COUNT(*) AS INTEGER) AS total_separations
  FROM opm
  WHERE duty_station_state IS NOT NULL
    AND (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
  GROUP BY duty_station_state
  HAVING TRY_CAST(MODE(duty_station_state_country_territory_code) AS INTEGER) <= 56
`;
```

```js
// 4. Reactive SQL for KPI metrics
const metricsResult = await db.sql`
  SELECT 
    COUNT(*) AS total_employees,
    AVG(annualized_adjusted_basic_pay) AS avg_salary,
    AVG(length_of_service_years) AS avg_tenure
  FROM opm
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
`;

const metrics = Array.from(metricsResult)[0];
```

```js
// 5. Reactive SQL & Plot for Age Bracket (Stacked by Position Occupied)
const ageData = await db.sql`
  SELECT 
    age_bracket, 
    COALESCE(position_occupied, 'Unknown') AS position_occupied,
    COUNT(*) AS count
  FROM opm
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    AND age_bracket IS NOT NULL
  GROUP BY age_bracket, position_occupied
`;

const ageChart = Plot.plot({
  marginLeft: 100,
  x: { label: "Number of Employees", grid: true },
  y: { label: null },
  color: { 
    legend: true, 
    label: "Position",
    scheme: "tableau10" 
  },
  marks: [
    Plot.barX(ageData, { 
      x: "count", 
      y: "age_bracket", 
      fill: "position_occupied", 
      sort: { y: "x", reverse: true },
      tip: true 
    }),
    Plot.ruleX([0])
  ]
});
```

```js
// 6. Reactive SQL & Plot for Top 10 Duty Station States (Stacked by Veteran Status)
const stateData = await db.sql`
  WITH TopStates AS (
    SELECT duty_station_state
    FROM opm
    WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
      AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
      AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
      AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
      AND duty_station_state IS NOT NULL
    GROUP BY duty_station_state
    ORDER BY COUNT(*) DESC
    LIMIT 10
  )
  SELECT 
    duty_station_state, 
    CASE 
      WHEN veteran_indicator = true THEN 'Veteran'
      WHEN veteran_indicator = false THEN 'Non-Veteran'
      ELSE 'Unknown' 
    END AS veteran_status,
    COUNT(*) AS count
  FROM opm
  WHERE duty_station_state IN (SELECT duty_station_state FROM TopStates)
    AND (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
  GROUP BY duty_station_state, veteran_indicator
`;

const stateChart = Plot.plot({
  marginLeft: 120,
  x: { label: "Number of Employees", grid: true },
  y: { label: null, sort: { y: "-x" } },
  color: { 
    legend: true, 
    label: "Veteran Status",
    domain: ["Veteran", "Non-Veteran", "Unknown"],
    range: ["#10b981", "#94a3b8", "#cbd5e1"] 
  },
  marks: [
    Plot.barX(stateData, { 
      x: "count", 
      y: "duty_station_state", 
      fill: "veteran_status", 
      tip: true 
    }),
    Plot.ruleX([0])
  ]
});
```

```js
// 7. Reactive SQL & Plot for Departures by Month (Stacked Bar Chart)
const monthlyData = await db.sql`
  SELECT 
    date_trunc('month', personnel_action_effective_date_yyyymm) AS Month, 
    separation_category,
    COUNT(*) AS count
  FROM opm
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    AND separation_category IS NOT NULL
    AND personnel_action_effective_date_yyyymm IS NOT NULL
  GROUP BY Month, separation_category
  ORDER BY Month
`;

// Helper function to keep UTC date formatting consistent
const formatMonth = (d) => new Date(d).toLocaleDateString("en-US", { 
  timeZone: "UTC", 
  month: "short", 
  year: "numeric" 
});

const departuresChart = Plot.plot({
  marginBottom: 60, 
  x: { 
    label: null, 
    tickFormat: formatMonth,
    tickRotate: -45
  },
  y: { label: "Departures", grid: true },
  color: { 
    legend: true, 
    label: "Category",
    scheme: "tableau10" 
  },
  marks: [
    Plot.barY(monthlyData, { 
      x: "Month", 
      y: "count", 
      fill: "separation_category", 
      tip: {
        format: {
          x: formatMonth
        }
      } 
    }),
    Plot.ruleY([0])
  ]
});
```

```js
// 8. Reactive SQL & Plot for Length of Service (Box Plot)
const serviceData = await db.sql`
  SELECT length_of_service_years
  FROM opm
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    AND length_of_service_years IS NOT NULL
`;

const serviceBoxPlot = resize((width, height) => Plot.plot({
  width,
  height,
  marginBottom: 45,
  x: { 
    label: "Length of Service (Years)", 
    grid: true,
    labelOffset: 30
  },
  y: { label: null },
  marks: [
    Plot.boxX(serviceData, { 
      x: "length_of_service_years", 
      fill: "#8b5cf6",
      tip: true 
    })
  ]
}));
```

```js
// 9. Reactive SQL for the Data Table
const tableData = await db.sql`
  SELECT
    drp_indicator AS DRP,
    agency AS Agency, 
    agency_subelement AS SubAgency,
    length_of_service_years AS Tenure, 
    occupational_series_code AS JobSeries,
    position_occupied AS ServiceType,
    age_bracket AS Age,
    grade AS Grade,
    annualized_adjusted_basic_pay AS Salary,
    flsa_category as FLSA,
    separation_category as DepartureType,
    strftime(personnel_action_effective_date_yyyymm, '%m/%Y') AS DepartureMonth
  FROM opm
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
  LIMIT 500
`;

const dataTable = Inputs.table(tableData, { layout: "auto" });
```

```js
// Generate the CSV string from the DuckDB result
const csvContent = d3.csvFormat(Array.from(tableData));

// Create a Blob and a downloadable URL
const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
const downloadUrl = URL.createObjectURL(blob);

// Create the button UI using Observable's html tagged template
const downloadButton = html`<a href="${downloadUrl}" download="opm_filtered_records.csv" style="display: inline-block; padding: 6px 12px; background: var(--theme-foreground-focus); color: var(--theme-background); text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 14px;">
  <span style="margin-right: 6px;">⬇️</span> Download CSV
</a>`;
```

<div class="grid grid-cols-3">
  <div class="card" style="display: flex; flex-direction: column; gap: 1rem;">
    ${agencyInput}
    ${subelementInput}
    ${drpInput}
  </div>
  <div class="card occ-card" style="grid-column: span 2;">${occInput}</div>
</div>

<div class="grid grid-cols-3">
  <div class="card">
    <h2>Total Separations</h2>
    <span class="big">${Number(metrics.total_employees).toLocaleString()}</span>
  </div>
  <div class="card">
    <h2>Average Salary</h2>
    <span class="big">
      ${metrics.avg_salary != null ? metrics.avg_salary.toLocaleString("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 0}) : "N/A"}
    </span>
  </div>
  <div class="card">
    <h2>Average Service (Years)</h2>
    <span class="big">
      ${metrics.avg_tenure != null ? metrics.avg_tenure.toFixed(1) : "N/A"}
    </span>
  </div>
</div>

<div class="grid grid-cols-2">
  <div class="card">
    <h3>Employees by Age Bracket and Type</h3>
    ${ageChart}
  </div>

  <div class="card">
    <h3>Top 10 Impacted States (+Veteran Status)</h3>
    ${stateChart}
  </div>
</div>

<div class="grid grid-cols-2">
  <div class="card">
    <h3>Departures by Month and Type</h3>
    ${departuresChart}
  </div>

  <div class="card">
    <h3>Length of Service Distribution</h3>
    ${serviceBoxPlot}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h3>Geographic Distribution of Separations</h3>
    <div style="display: flex; justify-content: center; width: 100%;">
      ${await usSeparationsMap(mapData)}
    </div>
  </div>
</div>

<div class="card">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
    <h3 style="margin: 0;">Related Records</h3>
    ${downloadButton}
  </div>
  
  <div class="table-scroll-container">
    ${dataTable}
  </div>
</div>

<style>
  .occ-card form {
    max-width: none;
    width: 100%;
  }
</style>