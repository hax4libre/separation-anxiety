---
title: Global Geographic Distribution
theme: dashboard
---

# Geographic Distribution of Separations
This map displays the global footprint of federal employees who departed while assigned to international duty stations. Select a country in *Country Detail Records* below to learn more about the affected personnel for that country. Germany had the largest concentration at 21 separations. Of particular interest, a NOAA scientist assigned to Antarctica seemingly had their appointment terminated eight months ahead of their "not to exceed" date. We're sending them warm thoughts and hoping they weren't actually *in* Antarctica when it happened.

```js
// 1. Imports and Database Initialization
import * as d3 from "npm:d3";
import { globalSeparationsMap } from "./components/worldMap.js";

// Initialize DuckDB just once for the entire page
const db = await DuckDBClient.of({ 
  opm: FileAttachment("./data/opm_data.parquet") 
});
```

```js
// 2. Aggregate data for the global map (Excluding the US)
const countryCountsResult = await db.sql`
  SELECT 
    TRIM(UPPER(duty_station_country)) AS country_name,
    CAST(COUNT(*) AS INTEGER) AS total_separations
  FROM opm
  WHERE duty_station_country IS NOT NULL
    AND TRIM(UPPER(duty_station_country)) != 'UNITED STATES'
  GROUP BY 1
  ORDER BY country_name
`;
```

<div class="card">
  ${await globalSeparationsMap(countryCountsResult)}
</div>

## Country Detail Records

```js
// 3. Extract the list of countries to populate our dropdown
const countries = Array.from(countryCountsResult).map(d => d.country_name);

// Create the dropdown, defaulting to the country with the most records
const countryInput = Inputs.select(countries, { label: "Select Country:", value: "GERMANY" });
const selectedCountry = Generators.input(countryInput);
```

```js
// 4. Query the raw records based on the dropdown selection
const tableData = await db.sql`
  SELECT
    drp_indicator AS "DRP", 
    agency_subelement AS "Agency", 
    occupational_series AS "Occupation",
    length_of_service_years AS "Years Served",
    strftime(appointment_not_to_exceed_date, '%m/%d/%Y') AS "NTE Date",  
    strftime(personnel_action_effective_date_yyyymm, '%m/%Y') AS "Effective Date", 
    separation_category AS "Category",
    age_bracket AS "Age",
    veteran_indicator AS "Veteran"
  FROM opm
  WHERE TRIM(UPPER(duty_station_country)) = ${selectedCountry}
  ORDER BY length_of_service_years DESC
`;
```

```js
// 5. Generate Export Button for International Records
const csvContent = d3.csvFormat(Array.from(tableData));
const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
const downloadUrl = URL.createObjectURL(blob);

const downloadButton = html`<a href="${downloadUrl}" download="international_separations.csv" style="display: inline-block; padding: 6px 12px; background: var(--theme-foreground-focus); color: var(--theme-background); text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 14px;">
  <span style="margin-right: 6px;">⬇️</span> Download CSV
</a>`;
```

<div class="card">
  <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 1rem;">
    <div>${countryInput}</div>
    <div>${downloadButton}</div>
  </div>
  
  <div class="table-scroll-container">
    ${Inputs.table(tableData, { layout: "auto" })}
  </div>
</div>

<style>
  .table-scroll-container {
    overflow-x: auto;
    width: 100%;
  }
  
  .table-scroll-container table th,
  .table-scroll-container table td {
    white-space: nowrap !important;
  }
</style>