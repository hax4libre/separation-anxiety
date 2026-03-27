---
title: Justice League
theme: dashboard
---

# Department of Justice Separations

Explore the impact of separations across the Department of Justice (DOJ). Use the filters below to drill down into specific DOJ components (such as the FBI, the US Attorneys Offices, or the Community Relations Service), occupations, demographics, and separation categories. 

```js
import * as d3 from "npm:d3";
```

```js
// 1. Initialize DuckDB with Parquet file
const db = await DuckDBClient.of({ 
  opm: FileAttachment("./data/opm_data.parquet") 
});

// Hardcoded agency variable for this specific page
const dojAgency = 'DEPARTMENT OF JUSTICE';
```

```js
// 2. Fetch independent filters (DRP, Veteran, STEM, Separation Category, Supervisory Status, Age)
const drpInput = Inputs.radio(["All", "true", "false"], { label: "DRP Indicator:", value: "All" });
const selectedDrp = Generators.input(drpInput);

const vetInput = Inputs.radio(["All", "true", "false"], { label: "Veteran Indicator:", value: "All" });
const selectedVet = Generators.input(vetInput);

const stemQuery = await db.sql`SELECT DISTINCT stem_occupation_type FROM opm WHERE agency = ${dojAgency} AND stem_occupation_type IS NOT NULL ORDER BY stem_occupation_type`;
const stemOptions = ["All", ...Array.from(stemQuery, d => d.stem_occupation_type)];
const stemInput = Inputs.select(stemOptions, { label: "STEM Type:", value: "All" });
const selectedStem = Generators.input(stemInput);

const sepCatQuery = await db.sql`SELECT DISTINCT separation_category FROM opm WHERE agency = ${dojAgency} AND separation_category IS NOT NULL ORDER BY separation_category`;
const sepCatOptions = ["All", ...Array.from(sepCatQuery, d => d.separation_category)];
const sepCatInput = Inputs.select(sepCatOptions, { label: "Separation Category:", value: "All" });
const selectedSepCat = Generators.input(sepCatInput);

const supQuery = await db.sql`SELECT DISTINCT supervisory_status FROM opm WHERE agency = ${dojAgency} AND supervisory_status IS NOT NULL ORDER BY supervisory_status`;
const supOptions = ["All", ...Array.from(supQuery, d => d.supervisory_status)];
const supInput = Inputs.select(supOptions, { label: "Supervisory Status:", value: "All" });
const selectedSup = Generators.input(supInput);

const ageQuery = await db.sql`SELECT DISTINCT age_bracket FROM opm WHERE agency = ${dojAgency} AND age_bracket IS NOT NULL ORDER BY age_bracket`;
const ageOptions = ["All", ...Array.from(ageQuery, d => d.age_bracket)];
const ageInput = Inputs.select(ageOptions, { label: "Age Bracket:", value: "All" });
const selectedAge = Generators.input(ageInput);
```

```js
// 3. DOJ Subelement Filter
const subQuery = await db.sql`
  SELECT DISTINCT agency_subelement 
  FROM opm 
  WHERE agency = ${dojAgency} AND agency_subelement IS NOT NULL 
  ORDER BY agency_subelement
`;
const subelements = ["All DOJ Components", ...Array.from(subQuery, d => d.agency_subelement)];
const subelementInput = Inputs.select(subelements, { label: "DOJ Component:", value: "All DOJ Components" });
const selectedSub = Generators.input(subelementInput);
```

```js
// 4. DEPENDENT FILTER: Fetch occupations based on selected DOJ Subelement
const occQuery = await db.sql`
  SELECT DISTINCT occupational_series_code, occupational_series 
  FROM opm 
  WHERE agency = ${dojAgency}
    AND (${selectedSub} = 'All DOJ Components' OR agency_subelement = ${selectedSub})
    AND occupational_series_code IS NOT NULL 
  ORDER BY occupational_series_code
`;

const occOptions = new Map([
  ["All", "All"],
  ...Array.from(occQuery, d => [
    `${d.occupational_series_code} - ${d.occupational_series ?? "Unknown"}`, 
    d.occupational_series_code
  ])
]);

const occInput = Inputs.select(occOptions, { label: "Occupation:", multiple: true, value: ["All"] });
const selectedOcc = Generators.input(occInput);
```

```js
// 5. Reactive SQL for KPI metrics
const metricsResult = await db.sql`
  SELECT 
    COUNT(*) AS total_employees,
    AVG(annualized_adjusted_basic_pay) AS avg_salary,
    AVG(length_of_service_years) AS avg_tenure
  FROM opm
  WHERE agency = ${dojAgency}
    AND (${selectedSub} = 'All DOJ Components' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
    AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
`;

const metrics = Array.from(metricsResult)[0];
```

```js
// 6. Reactive SQL & Plot for Departures by DOJ Component (Stacked by Leadership)
const componentData = await db.sql`
  WITH TopComponents AS (
    SELECT COALESCE(agency_subelement, 'Unknown') AS component
    FROM opm
    WHERE agency = ${dojAgency}
      AND (${selectedSub} = 'All DOJ Components' OR agency_subelement = ${selectedSub})
      AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
      AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
      AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
      AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
      AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
      AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
      AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    GROUP BY component
    ORDER BY COUNT(*) DESC
  )
  SELECT 
    COALESCE(agency_subelement, 'Unknown') AS component,
    CASE 
      WHEN (supervisory_status IS NOT NULL AND supervisory_status NOT LIKE '%ALL OTHER POSITIONS%')
        OR pay_plan_code IN ('ES', 'SL', 'ST') 
      THEN 'Leadership'
      ELSE 'Non-Leadership'
    END AS leadership_status,
    COUNT(*) AS count
  FROM opm
  WHERE agency = ${dojAgency}
    AND COALESCE(agency_subelement, 'Unknown') IN (SELECT component FROM TopComponents)
    AND (${selectedSub} = 'All DOJ Components' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
    AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
  GROUP BY component, leadership_status
`;

const componentChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.25);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
  width,
  marginLeft: safeMarginLeft, 
  marginRight: 40,
  marginBottom: 40, 
    x: { label: "Total Separations", grid: true },
    y: { 
      label: null, 
      sort: { y: "-x" },
      tickFormat: (d) => d.length > maxChars ? d.slice(0, maxChars - 3) + "..." : d
    },
    color: { 
      legend: true, 
      domain: ["Leadership", "Non-Leadership"],
      range: ["#f59e0b", "#0ea5e9"] 
    },
    marks: [
      Plot.barX(componentData, { 
        x: "count", 
        y: "component", 
        fill: "leadership_status", 
        order: "sum", 
        tip: true 
      }),
      Plot.ruleX([0])
    ]
  });
});
```

```js
// 7. Reactive SQL & Plot for Departures by Month
const monthlyData = await db.sql`
  SELECT 
    date_trunc('month', personnel_action_effective_date_yyyymm) AS Month, 
    separation_category,
    COUNT(*) AS count
  FROM opm
  WHERE agency = ${dojAgency}
    AND (${selectedSub} = 'All DOJ Components' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
    AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    AND separation_category IS NOT NULL
    AND personnel_action_effective_date_yyyymm IS NOT NULL
  GROUP BY Month, separation_category
  ORDER BY Month
`;

const formatMonth = (d) => new Date(d).toLocaleDateString("en-US", { 
  timeZone: "UTC", 
  month: "short", 
  year: "numeric" 
});

const departuresChart = resize((width) => Plot.plot({
  width, 
  marginBottom: 40, 
  x: { 
    label: null, 
    tickFormat: formatMonth,
    tickRotate: -45
  },
  y: { label: "Departures", grid: true },
  color: { 
    legend: true, 
    label: "Category",
    scheme: "observable10" 
  },
  marks: [
    Plot.barY(monthlyData, { 
      x: "Month", 
      y: "count", 
      fill: "separation_category", 
      tip: {
        format: { x: formatMonth }
      } 
    }),
    Plot.ruleY([0])
  ]
}));
```

```js
// 8. Reactive SQL for Data Table
const tableData = await db.sql`
  SELECT
    agency_subelement AS Component,
    occupational_series AS Occupation,
    occupational_series_code AS JobSeries,
    supervisory_status AS SupervisoryStatus,
    length_of_service_years AS Tenure, 
    age_bracket AS Age,
    annualized_adjusted_basic_pay AS Salary,
    separation_category as DepartureType,
    stem_occupation_type AS STEMType,
    drp_indicator AS DRP,
    veteran_indicator AS Veteran,
    strftime(personnel_action_effective_date_yyyymm, '%m/%Y') AS DepartureMonth
  FROM opm
  WHERE agency = ${dojAgency}
    AND (${selectedSub} = 'All DOJ Components' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
    AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
  LIMIT 500
`;

const dataTable = Inputs.table(tableData, { layout: "auto" });

const csvContent = d3.csvFormat(Array.from(tableData));
const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
const downloadUrl = URL.createObjectURL(blob);
const downloadButton = html`<a href="${downloadUrl}" download="doj_separations.csv" style="display: inline-block; padding: 6px 12px; background: var(--theme-foreground-focus); color: var(--theme-background); text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 14px;">
  <span style="margin-right: 6px;">⬇️</span> Download CSV
</a>`;
```

```js
// 9. Reactive SQL & Plot for Retirement Eligibility Tiers
const eligibilityData = await db.sql`
  SELECT 
    CASE 
      WHEN length_of_service_years >= 25 THEN 'Eligible (Any Age, 25+ Yrs)'
      WHEN TRY_CAST(SUBSTRING(age_bracket, 1, 2) AS INTEGER) >= 50 
       AND length_of_service_years >= 20 THEN 'Eligible (Age 50+, 20+ Yrs)'
      WHEN TRY_CAST(SUBSTRING(age_bracket, 1, 2) AS INTEGER) >= 60 
       AND length_of_service_years >= 5 THEN 'Eligible (Age 62+, 5+ Yrs)'
      WHEN TRY_CAST(SUBSTRING(age_bracket, 1, 2) AS INTEGER) >= 55 
       AND length_of_service_years >= 10 THEN 'Eligible (MRA, 10+ Yrs)'
      WHEN separation_category = 'RETIREMENT - OTHER' THEN 'Disability/Other'
      ELSE 'Not Eligible / Resignation'
    END AS retirement_tier,
    separation_category,
    COUNT(*) AS count
  FROM opm
  WHERE agency = ${dojAgency}
    AND (${selectedSub} = 'All DOJ Components' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
    AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    AND age_bracket IS NOT NULL 
    AND length_of_service_years IS NOT NULL
  GROUP BY retirement_tier, separation_category
`;

const eligibilityChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.2);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
  width,
  marginLeft: safeMarginLeft, 
  marginRight: 40,
  marginBottom: 40,
  x: { label: "Total Separations", grid: true },
  y: { label: null,
       sort: { y: "x", reverse: true },
       tickFormat: (d) => d.length > maxChars ? d.slice(0, maxChars - 3) + "..." : d
     },
  color: { 
    legend: true,
    scheme: "observable10",
    label: "Category"
  },
  marks: [
    Plot.barX(eligibilityData, { 
      x: "count", 
      y: "retirement_tier", 
      fill: "separation_category", 
      order: "sum", 
      tip: true 
    }),
    Plot.ruleX([0])
  ]
})});
```

```js
// 10. Reactive SQL & Plot for Occupational Group and Series
const occGroupData = await db.sql`
  WITH TopGroups AS (
    SELECT 
      COALESCE(occupational_group_code, 'Unknown') || ' - ' || COALESCE(occupational_group, 'Unknown Group') AS occ_group, 
      COUNT(*) as total
    FROM opm
    WHERE agency = ${dojAgency}
      AND (${selectedSub} = 'All DOJ Components' OR agency_subelement = ${selectedSub})
      AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
      AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
      AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
      AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
      AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
      AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
      AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    GROUP BY occ_group
    ORDER BY total DESC
    LIMIT 20
  )
  SELECT 
    COALESCE(occupational_group_code, 'Unknown') || ' - ' || COALESCE(occupational_group, 'Unknown Group') AS occ_group,
    COALESCE(occupational_series_code, 'Unknown') || ' - ' || COALESCE(occupational_series, 'Unknown Series') AS occ_series,
    COUNT(*) AS count
  FROM opm
  WHERE agency = ${dojAgency}
    AND COALESCE(occupational_group_code, 'Unknown') || ' - ' || COALESCE(occupational_group, 'Unknown Group') IN (SELECT occ_group FROM TopGroups)
    AND (${selectedSub} = 'All DOJ Components' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
    AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
  GROUP BY occ_group, occ_series
`;

const occGroupChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.25);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
  width,
  marginLeft: safeMarginLeft, 
  marginRight: 40,
  marginBottom: 40,
  x: { label: "Total Separations", grid: true },
  y: { 
    label: null, 
    sort: { y: "-x" },
    tickFormat: (d) => d.length > maxChars ? d.slice(0, maxChars - 3) + "..." : d
  },
  color: { 
    scheme: "observable10" 
  }, 
  marks: [
    Plot.barX(occGroupData, { 
      x: "count", 
      y: "occ_group", 
      fill: "occ_series", 
      order: "sum", 
      tip: true,
      stroke: "var(--theme-background)", 
      strokeWidth: 0.5
    }),
    Plot.ruleX([0])
  ]
})});
```

```js
// 11. Loss of Subject Matter Experts (Grade vs Tenure Scatter)
const smeData = await db.sql`
  SELECT 
    length_of_service_years,
    annualized_adjusted_basic_pay,
    COALESCE(occupational_series, 'Unknown') AS series,
    pay_plan_code || '-' || grade AS grade_level
  FROM opm
  WHERE agency = ${dojAgency}
    AND length_of_service_years IS NOT NULL
    AND annualized_adjusted_basic_pay IS NOT NULL
    AND (${selectedSub} = 'All DOJ Components' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
    AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
`;

const smeChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.1);

  return Plot.plot({
  width,
  marginLeft: safeMarginLeft, 
  marginRight: 40,
  marginBottom: 40,
  x: { label: "Length of Service (Years)", grid: true },
  y: { label: "Annualized Basic Pay ($)",
       grid: true,
       tickFormat: "s" 
   },
  color: { legend: false }, // Let Plot handle categorical colors automatically, but hide the massive legend
  marks: [
    Plot.dot(smeData, { 
      x: "length_of_service_years", 
      y: "annualized_adjusted_basic_pay", 
      stroke: "series",
      fill: "series",
      fillOpacity: 0.5,
      r: 4, // Slightly larger dots for better visibility
      tip: true 
    })
  ]
})});
```

```js
// 12. Critical Operational Drain (Box Plot)
const criticalData = await db.sql`
  SELECT 
    COALESCE(occupational_series, 'Unknown') AS occupational_series,
    length_of_service_years
  FROM opm
  WHERE agency = ${dojAgency}
    AND occupational_series_code IN ('2210', '0132', '1811', '0905')
    AND length_of_service_years IS NOT NULL
    AND (${selectedSub} = 'All DOJ Components' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
    AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
`;

const criticalChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.2);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
  width,
  marginLeft: safeMarginLeft, 
  marginRight: 40,
  marginBottom: 40,
  x: { label: "Length of Service (Years)", grid: true },
  y: { label: null ,
    tickFormat: (d) => d.length > maxChars ? d.slice(0, maxChars - 3) + "..." : d
  },
  color: { scheme: "observable10" },
  marks: [
    Plot.boxX(criticalData, { 
      x: "length_of_service_years", 
      y: "occupational_series", 
      fill: "occupational_series",
      tip: true,
      clip: true
    })
  ]
})});
```

<div class="grid grid-cols-3">
  <div class="card" style="display: flex; flex-direction: column; gap: 1rem;">
    ${subelementInput}
    ${stemInput}
    ${sepCatInput}
    ${supInput}
    ${ageInput}
  </div>
  <div class="card occ-card" style="grid-column: span 2; display: flex; flex-direction: column; gap: 1rem;">
    ${occInput}
    <div style="display: flex; gap: 2rem;">
      ${drpInput}
      ${vetInput}
    </div>
  </div>
</div>

<div class="grid grid-cols-3">
  <div class="card">
    <h2>DOJ Separations</h2>
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

<div class="grid grid-cols-1">
  <div class="card">
    <h3>Departures by DOJ Component & Leadership Status</h3>
    ${componentChart}
  </div>
</div>

<div class="grid grid-cols-1">
<div class="card">
    <h3>Critical Operational Drain</h3>
    <p style="color: var(--theme-foreground-muted); font-size: 0.9em; margin-top: 0;"><em>Tenure distribution for highly specialized, hard-to-replace roles.</em></p>
    ${criticalChart}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h3>Retirement Eligibility v. Departure Type</h3>
    <p style="color: var(--theme-foreground-muted); font-size: 0.9em; margin-top: 0;"><em>NOTE: A small number of separations computed as not eligible for retirement but still retired. These are likely representative of creditable service that was not reflected in OPM's data.</em></p>
    ${eligibilityChart}
  </div>
</div>

<div class="grid grid-cols-1">
    <div class="card">
    <h3>Subject Matter Expert Drain (Tenure vs. Pay)</h3>
    <p style="color: var(--theme-foreground-muted); font-size: 0.9em; margin-top: 0;"><em>Each dot represents a departure. The ceiling just below $200k represents the highest salary attainable for GS employees, which comprise the majority of the workforce.</em></p>
    ${smeChart}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h3>Departures by Occupational Group & Series (Top 20)</h3>
    <p style="color: var(--theme-foreground-muted); font-size: 0.9em; margin-top: 0;"><em>The broad occupational groups with the highest volume of separations. Hover over the segments to see the specific job series.</em></p>
    ${occGroupChart}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h3>DOJ Departures by Month and Type</h3>
    ${departuresChart}
  </div>
</div>

<div class="card">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
    <h3 style="margin: 0;">DOJ Separation Records</h3>
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