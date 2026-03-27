---
title: Leadership Impact
theme: dashboard
---

# Leadership Impact Across Agencies

Explore the impact of separating leaders, managers, and executives across the federal workforce. Use the filters below to drill down into specific agencies, occupations, or demographics, compared with government-wide trends.

Filtering by **Agency > Department of Justice** and **Occupation > 0905 - General Attorney** shows the outsized impact on DOJ attorney leadership over the past year, when compared to other departments within the federal government.

```js
// 1. Initialize DuckDB with Parquet file
const db = await DuckDBClient.of({ 
  opm: FileAttachment("./data/opm_data.parquet") 
});
```

```js
// 2. Fetch independent filters (Agency, STEM, Separation Category, DRP, Veteran)
const agencyQuery = await db.sql`SELECT DISTINCT agency FROM opm WHERE agency IS NOT NULL ORDER BY agency`;
const agencies = ["All Agencies", ...Array.from(agencyQuery, d => d.agency)];
const agencyInput = Inputs.select(agencies, { label: "Agency:", value: "All Agencies" });
const selectedAgency = Generators.input(agencyInput);

const stemQuery = await db.sql`SELECT DISTINCT stem_occupation_type FROM opm WHERE stem_occupation_type IS NOT NULL ORDER BY stem_occupation_type`;
const stemOptions = ["All", ...Array.from(stemQuery, d => d.stem_occupation_type)];
const stemInput = Inputs.select(stemOptions, { label: "STEM Type:", value: "All" });
const selectedStem = Generators.input(stemInput);

const sepCatQuery = await db.sql`SELECT DISTINCT separation_category FROM opm WHERE separation_category IS NOT NULL ORDER BY separation_category`;
const sepCatOptions = ["All", ...Array.from(sepCatQuery, d => d.separation_category)];
const sepCatInput = Inputs.select(sepCatOptions, { label: "Separation Category:", value: "All" });
const selectedSepCat = Generators.input(sepCatInput);

const drpInput = Inputs.radio(["All", "true", "false"], { label: "DRP Indicator:", value: "All" });
const selectedDrp = Generators.input(drpInput);

const vetInput = Inputs.radio(["All", "true", "false"], { label: "Veteran Indicator:", value: "All" });
const selectedVet = Generators.input(vetInput);
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
// 4. Reactive SQL for Leadership KPI metrics
// Defining leadership: explicit supervisory status OR executive pay plan codes (ES, SL, ST)
const metricsResult = await db.sql`
  SELECT 
    COUNT(*) AS total_leaders,
    AVG(annualized_adjusted_basic_pay) AS avg_salary,
    AVG(length_of_service_years) AS avg_tenure
  FROM opm
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (
      (supervisory_status IS NOT NULL AND supervisory_status NOT LIKE '%ALL OTHER POSITIONS%')
      OR pay_plan_code IN ('ES', 'SL', 'ST')
    )
`;

const metrics = Array.from(metricsResult)[0];
```

```js
// 5. Reactive SQL & Plot for Departures by Month (Area Chart)
const monthlyData = await db.sql`
  SELECT 
    date_trunc('month', personnel_action_effective_date_yyyymm) AS Month, 
    separation_category,
    COUNT(*) AS count
  FROM opm
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (
      (supervisory_status IS NOT NULL AND supervisory_status NOT LIKE '%ALL OTHER POSITIONS%')
      OR pay_plan_code IN ('ES', 'SL', 'ST')
    )
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

const departuresChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.1);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
  width,
  marginLeft: safeMarginLeft, 
  marginRight: 40,
  marginBottom: 40, 
  x: { 
    label: null, 
    tickFormat: formatMonth,
    tickRotate: -45
  },
  y: { label: "Leadership Departures", grid: true },
  color: { 
    legend: true, 
    label: "Category",
    scheme: "observable10",
    tickFormat: (d) => d.length > maxChars ? d.slice(0, maxChars - 3) + "..." : d
  },
  marks: [
    Plot.areaY(monthlyData, { 
      x: "Month", 
      y: "count", 
      fill: "separation_category", 
      tip: {
        format: {
          x: formatMonth
        }
      },
      order: "sum"
    }),
    Plot.ruleY([0])
  ]
})});
```

```js
// 6. Government-Wide Comparison (Stacked by Subelement)
// Ignores Subelement/Agency Filter for context, but APPLIES all other demographic/occupational filters
const comparisonData = await db.sql`
  WITH TopAgencies AS (
    SELECT agency
    FROM opm
    WHERE (
        (supervisory_status IS NOT NULL AND supervisory_status NOT LIKE '%ALL OTHER POSITIONS%')
        OR pay_plan_code IN ('ES', 'SL', 'ST')
      )
      AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
      AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
      AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
      AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
      AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    GROUP BY agency
    ORDER BY COUNT(*) DESC
    LIMIT 15
  )
  SELECT 
    agency,
    COALESCE(agency_subelement, 'Unknown Subelement') AS subelement,
    COUNT(*) AS count
  FROM opm
  WHERE agency IN (SELECT agency FROM TopAgencies)
    AND (
      (supervisory_status IS NOT NULL AND supervisory_status NOT LIKE '%ALL OTHER POSITIONS%')
      OR pay_plan_code IN ('ES', 'SL', 'ST')
    )
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
  GROUP BY agency, subelement
`;

const comparisonChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.2);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
  width,
  marginLeft: safeMarginLeft, 
  marginRight: 40,
  marginBottom: 40, 
  x: { label: "Total Leadership Separations", grid: true },
  y: { label: null,
   sort: { y: "-x" },
   tickFormat: (d) => d.length > maxChars ? d.slice(0, maxChars - 3) + "..." : d
   },
  color: { scheme: "observable10" }, 
  marks: [
    Plot.barX(comparisonData, { 
      x: "count", 
      y: "agency", 
      fill: "subelement", 
      tip: true,
      order: "sum" 
    }),
    Plot.ruleX([0])
  ]
})});
```

```js
// 7. Reactive SQL & Plot for Leadership Types
const roleData = await db.sql`
  SELECT 
    CASE 
      WHEN supervisory_status LIKE '%ALL OTHER POSITIONS%' THEN 'SENIOR EXECUTIVE (NON-SUPERVISORY)'
      ELSE COALESCE(supervisory_status, 'UNKNOWN')
    END AS leadership_category,
    COUNT(*) AS count
  FROM opm
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (
      (supervisory_status IS NOT NULL AND supervisory_status NOT LIKE '%ALL OTHER POSITIONS%')
      OR pay_plan_code IN ('ES', 'SL', 'ST')
    )
  GROUP BY leadership_category
  ORDER BY count DESC
`;

const roleChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.25);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
  width,
  marginLeft: safeMarginLeft, 
  marginRight: 40,
  marginBottom: 40, 
  x: { label: "Number of Departures", grid: true },
  y: { label: null,
   sort: { y: "-x" },
   tickFormat: (d) => d.length > maxChars ? d.slice(0, maxChars - 3) + "..." : d
   },
  marks: [
    Plot.barX(roleData, { 
      x: "count", 
      y: "leadership_category", 
      fill: "#3b82f6", 
      tip: true 
    }),
    Plot.ruleX([0])
  ]
})});
```

```js
// 8. Reactive SQL & Plot for Position Occupied
const positionData = await db.sql`
  SELECT 
    COALESCE(position_occupied, 'Unknown') AS position_occupied,
    COUNT(*) AS count
  FROM opm
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (
      (supervisory_status IS NOT NULL AND supervisory_status NOT LIKE '%ALL OTHER POSITIONS%')
      OR pay_plan_code IN ('ES', 'SL', 'ST')
    )
  GROUP BY position_occupied
  ORDER BY count DESC
`;

const positionChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.25);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
  width,
  marginLeft: safeMarginLeft, 
  marginRight: 40,
  marginBottom: 40,
  x: { label: "Number of Departures", grid: true },
  y: { label: null,
       sort: { y: "-x" },
       tickFormat: (d) => d.length > maxChars ? d.slice(0, maxChars - 3) + "..." : d
     },
  marks: [
    Plot.barX(positionData, { 
      x: "count", 
      y: "position_occupied", 
      fill: "#8b5cf6", 
      tip: true 
    }),
    Plot.ruleX([0])
  ]
})});
```

```js
// 9. Reactive SQL for the Data Table
const tableData = await db.sql`
  SELECT
    agency AS Agency, 
    agency_subelement AS SubAgency,
    CASE 
      WHEN supervisory_status LIKE '%ALL OTHER POSITIONS%' THEN 'SENIOR EXECUTIVE (NON-SUPERVISORY)'
      ELSE COALESCE(supervisory_status, 'UNKNOWN')
    END AS LeadershipRole,
    veteran_indicator AS Veteran,
    position_occupied AS PositionOccupied,
    stem_occupation_type AS STEMType,
    pay_plan AS PayPlan,
    length_of_service_years AS Tenure, 
    occupational_series_code AS JobSeries,
    age_bracket AS Age,
    grade AS Grade,
    annualized_adjusted_basic_pay AS Salary,
    separation_category as DepartureType,
    strftime(personnel_action_effective_date_yyyymm, '%m/%Y') AS DepartureMonth
  FROM opm
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Subelements' OR agency_subelement = ${selectedSub})
    AND (${selectedDrp} = 'All' OR CAST(drp_indicator AS VARCHAR) = ${selectedDrp})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSepCat} = 'All' OR separation_category = ${selectedSepCat})
    AND (
      (supervisory_status IS NOT NULL AND supervisory_status NOT LIKE '%ALL OTHER POSITIONS%')
      OR pay_plan_code IN ('ES', 'SL', 'ST')
    )
  LIMIT 500
`;

const dataTable = Inputs.table(tableData, { layout: "auto" });

// CSV Download setup
const csvContent = d3.csvFormat(Array.from(tableData));
const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
const downloadUrl = URL.createObjectURL(blob);
const downloadButton = html`<a href="${downloadUrl}" download="opm_leadership_records.csv" style="display: inline-block; padding: 6px 12px; background: var(--theme-foreground-focus); color: var(--theme-background); text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 14px;">
  <span style="margin-right: 6px;">⬇️</span> Download CSV
</a>`;
```

<div class="grid grid-cols-4">
  <div class="card" style="display: flex; flex-direction: column; gap: 1rem;">
    ${agencyInput}
    ${subelementInput}
    ${drpInput}
  </div>
  <div class="card" style="display: flex; flex-direction: column; gap: 1rem;">
    ${stemInput}
    ${sepCatInput}
    ${vetInput}
  </div>
  <div class="card occ-card" style="grid-column: span 2; display: flex; flex-direction: column; gap: 1rem;">
    ${occInput}
  </div>
</div>

<div class="grid grid-cols-3">
  <div class="card">
    <h2>Leadership Separations</h2>
    <span class="big">${Number(metrics.total_leaders).toLocaleString()}</span>
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
    <h3>Government-Wide Leadership Attrition (Top 15 Agencies)</h3>
    <p style="color: var(--theme-foreground-muted); font-size: 0.9em; margin-top: 0;"><em>This chart reflects your selected demographics & occupation filters for global context. The bars reflect an agency's loss accross subcomponents.</em></p>
    ${comparisonChart}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h3>Departures by Month and Type</h3>
    ${departuresChart}
  </div>
</div>

<div class="grid grid-cols-2">
  <div class="card">
    <h3>Departures by Leadership Role</h3>
    ${roleChart}
  </div>
  <div class="card">
    <h3>Departures by Position Occupied</h3>
    ${positionChart}
  </div>
</div>

<div class="card">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
    <h3 style="margin: 0;">Leadership Separation Records</h3>
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
