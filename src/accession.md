---
title: Dismal Ascent
theme: dashboard
---

# Dismal Ascent: 2025 Federal Accessions

By popular demand, learn who entered the federal workforce and how between January 2025 and January 2026. 
Use the filters to drill down into specific agencies, subcomponents, occupations, demographics, and accession (hiring) categories. 

```js
import * as d3 from "npm:d3";
```

```js
// 1. Initialize DuckDB with Parquet file and Load JSON Lookups
const db = await DuckDBClient.of({ 
  accessions: FileAttachment("./data/opm_accessions.parquet") 
});

const lookups = await FileAttachment("./data/xwalk.json").json();

// Helper function to translate database codes to text for the UI
const getDesc = (cat, code) => {
  if (code === null || code === undefined) return "Unknown";
  const strCode = String(code); 
  if (lookups[cat] && lookups[cat][strCode]) {
    return String(lookups[cat][strCode]);
  }
  return strCode;
};

// Helper function to truncate long axis labels without crashing on nulls
const truncate = (text, maxChars) => {
  if (text == null) return "";
  const str = String(text);
  return str.length > maxChars ? str.slice(0, maxChars - 3) + "..." : str;
};
```

```js
// 2. Fetch independent filters
const vetInput = Inputs.radio(["All", "true", "false"], { label: "Veteran Indicator:", value: "All" });
const selectedVet = Generators.input(vetInput);

const stemQuery = await db.sql`SELECT DISTINCT stem_occupation_type FROM accessions WHERE stem_occupation_type IS NOT NULL ORDER BY stem_occupation_type`;
const stemOptions = ["All", ...Array.from(stemQuery, d => String(d.stem_occupation_type))];
const stemInput = Inputs.select(stemOptions, { label: "STEM Type:", value: "All" });
const selectedStem = Generators.input(stemInput);

const accCatQuery = await db.sql`SELECT DISTINCT accession_category_code FROM accessions WHERE accession_category_code IS NOT NULL`;
const sortedAccCatCodes = Array.from(accCatQuery, d => String(d.accession_category_code))
  .sort((a, b) => getDesc("accession_category", a).localeCompare(getDesc("accession_category", b)));
const accCatInput = Inputs.select(["All", ...sortedAccCatCodes], { 
  label: "Accession Category:", 
  value: "All",
  format: d => d === "All" ? "All Categories" : getDesc("accession_category", d)
});
const selectedAccCat = Generators.input(accCatInput);

const supQuery = await db.sql`SELECT DISTINCT supervisory_status_code FROM accessions WHERE supervisory_status_code IS NOT NULL`;
const sortedSupCodes = Array.from(supQuery, d => String(d.supervisory_status_code))
  .sort((a, b) => getDesc("supervisory_status", a).localeCompare(getDesc("supervisory_status", b)));
const supInput = Inputs.select(["All", ...sortedSupCodes], { 
  label: "Supervisory Status:", 
  value: "All",
  format: d => d === "All" ? "All Statuses" : getDesc("supervisory_status", d)
});
const selectedSup = Generators.input(supInput);

const ageQuery = await db.sql`SELECT DISTINCT age_bracket FROM accessions WHERE age_bracket IS NOT NULL ORDER BY age_bracket`;
const ageOptions = ["All", ...Array.from(ageQuery, d => String(d.age_bracket))];
const ageInput = Inputs.select(ageOptions, { label: "Age Bracket:", value: "All" });
const selectedAge = Generators.input(ageInput);
```

```js
// 3. Agency Filter
const agencyQuery = await db.sql`
  SELECT DISTINCT agency_code 
  FROM accessions 
  WHERE agency_code IS NOT NULL
`;
const sortedAgencyCodes = Array.from(agencyQuery, d => String(d.agency_code))
  .sort((a, b) => getDesc("agency", a).localeCompare(getDesc("agency", b)));
const agencyInput = Inputs.select(["All Agencies", ...sortedAgencyCodes], { 
  label: "Agency:", 
  value: "All Agencies",
  format: d => d === "All Agencies" ? "All Agencies" : getDesc("agency", d)
});
const selectedAgency = Generators.input(agencyInput);
```

```js
// 4a. DEPENDENT FILTER: Fetch Components
const subQuery = await db.sql`
  SELECT DISTINCT agency_subelement_code 
  FROM accessions 
  WHERE (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
    AND agency_subelement_code IS NOT NULL
`;

const sortedSubCodes = Array.from(subQuery, d => String(d.agency_subelement_code))
  .sort((a, b) => getDesc("agency_subelement", a).localeCompare(getDesc("agency_subelement", b)));

const subInput = Inputs.select(["All Components", ...sortedSubCodes], { 
  label: "Component:", 
  value: "All Components",
  format: d => d === "All Components" ? "All Components" : getDesc("agency_subelement", d)
});
const selectedSub = Generators.input(subInput);
```

```js
// 4b. DEPENDENT FILTER: Fetch Occupations
const occQuery = await db.sql`
  SELECT DISTINCT occupational_series_code 
  FROM accessions 
  WHERE (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR CAST(agency_subelement_code AS VARCHAR) = ${selectedSub})
    AND occupational_series_code IS NOT NULL 
  ORDER BY occupational_series_code
`;

const occOptions = new Map([
  ["All", "All"],
  ...Array.from(occQuery, d => [
    `${d.occupational_series_code} - ${getDesc("occupational_series", d.occupational_series_code)}`, 
    String(d.occupational_series_code)
  ])
]);

const occInput = Inputs.select(occOptions, { label: "Occupation:", multiple: true, value: ["All"] });
const selectedOcc = Generators.input(occInput);
```

```js
// 5. KPI Metrics
const metricsResult = await db.sql`
  SELECT 
    COUNT(*) AS total_employees,
    SUM(CASE 
      WHEN (supervisory_status_code IS NOT NULL AND CAST(supervisory_status_code AS VARCHAR) != '8')
        OR pay_plan_code IN ('ES', 'SL', 'ST') 
      THEN 1 ELSE 0 END) AS total_leadership,
    SUM(CASE 
      WHEN NOT ((supervisory_status_code IS NOT NULL AND CAST(supervisory_status_code AS VARCHAR) != '8')
        OR pay_plan_code IN ('ES', 'SL', 'ST')) 
      THEN 1 ELSE 0 END) AS total_non_leadership,
      
    AVG(annualized_adjusted_basic_pay) AS avg_salary,
    AVG(CASE 
      WHEN (supervisory_status_code IS NOT NULL AND CAST(supervisory_status_code AS VARCHAR) != '8')
        OR pay_plan_code IN ('ES', 'SL', 'ST') 
      THEN annualized_adjusted_basic_pay ELSE NULL END) AS avg_salary_leadership,
    AVG(CASE 
      WHEN NOT ((supervisory_status_code IS NOT NULL AND CAST(supervisory_status_code AS VARCHAR) != '8')
        OR pay_plan_code IN ('ES', 'SL', 'ST')) 
      THEN annualized_adjusted_basic_pay ELSE NULL END) AS avg_salary_non_leadership,
      
    AVG(length_of_service_years) AS avg_tenure,
    AVG(CASE 
      WHEN (supervisory_status_code IS NOT NULL AND CAST(supervisory_status_code AS VARCHAR) != '8')
        OR pay_plan_code IN ('ES', 'SL', 'ST') 
      THEN length_of_service_years ELSE NULL END) AS avg_tenure_leadership,
    AVG(CASE 
      WHEN NOT ((supervisory_status_code IS NOT NULL AND CAST(supervisory_status_code AS VARCHAR) != '8')
        OR pay_plan_code IN ('ES', 'SL', 'ST')) 
      THEN length_of_service_years ELSE NULL END) AS avg_tenure_non_leadership
      
  FROM accessions
  WHERE (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR CAST(agency_subelement_code AS VARCHAR) = ${selectedSub})
    AND (${selectedVet} = 'All' OR veteran_indicator = CAST(${selectedVet} AS BOOLEAN))
    AND (${selectedStem} = 'All' OR CAST(stem_occupation_type AS VARCHAR) = ${selectedStem})
    AND (${selectedAccCat} = 'All' OR CAST(accession_category_code AS VARCHAR) = ${selectedAccCat})
    AND (${selectedSup} = 'All' OR CAST(supervisory_status_code AS VARCHAR) = ${selectedSup})
    AND (${selectedAge} = 'All' OR CAST(age_bracket AS VARCHAR) = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), CAST(occupational_series_code AS VARCHAR)))
`;
const metrics = Array.from(metricsResult)[0];

// Generate the Leadership Split UI conditionally for all three cards
const leadershipSplitHtml = selectedAgency !== 'All Agencies' ? html`
  <div style="display: flex; justify-content: space-between; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--theme-border);">
    <div style="display: flex; flex-direction: column;">
      <span style="color: #f59e0b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Leaders</span>
      <span style="color: #f59e0b; font-size: 1.1rem; font-weight: 600;">${Number(metrics.total_leadership).toLocaleString()}</span>
    </div>
    <div style="display: flex; flex-direction: column; text-align: right;">
      <span style="color: #0ea5e9; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Non-Leaders</span>
      <span style="color: #0ea5e9; font-size: 1.1rem; font-weight: 600;">${Number(metrics.total_non_leadership).toLocaleString()}</span>
    </div>
  </div>
` : "";

const salarySplitHtml = selectedAgency !== 'All Agencies' ? html`
  <div style="display: flex; justify-content: space-between; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--theme-border);">
    <div style="display: flex; flex-direction: column;">
      <span style="color: #f59e0b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Leaders</span>
      <span style="color: #f59e0b; font-size: 1.1rem; font-weight: 600;">${metrics.avg_salary_leadership != null ? metrics.avg_salary_leadership.toLocaleString("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 0}) : "N/A"}</span>
    </div>
    <div style="display: flex; flex-direction: column; text-align: right;">
      <span style="color: #0ea5e9; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Non-Leaders</span>
      <span style="color: #0ea5e9; font-size: 1.1rem; font-weight: 600;">${metrics.avg_salary_non_leadership != null ? metrics.avg_salary_non_leadership.toLocaleString("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 0}) : "N/A"}</span>
    </div>
  </div>
` : "";

const tenureSplitHtml = selectedAgency !== 'All Agencies' ? html`
  <div style="display: flex; justify-content: space-between; margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px solid var(--theme-border);">
    <div style="display: flex; flex-direction: column;">
      <span style="color: #f59e0b; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Leaders</span>
      <span style="color: #f59e0b; font-size: 1.1rem; font-weight: 600;">${metrics.avg_tenure_leadership != null ? metrics.avg_tenure_leadership.toFixed(1) : "N/A"}</span>
    </div>
    <div style="display: flex; flex-direction: column; text-align: right;">
      <span style="color: #0ea5e9; font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">Non-Leaders</span>
      <span style="color: #0ea5e9; font-size: 1.1rem; font-weight: 600;">${metrics.avg_tenure_non_leadership != null ? metrics.avg_tenure_non_leadership.toFixed(1) : "N/A"}</span>
    </div>
  </div>
` : "";
```

```js
// 6. Chart: Accessions by Agency & Leadership Status (Top 20)
const isAgencyLevel = selectedAgency === 'All Agencies';

const componentData = await db.sql`
  WITH TopComponents AS (
    SELECT 
      CASE WHEN ${selectedAgency} = 'All Agencies' THEN COALESCE(CAST(agency_code AS VARCHAR), 'Unknown')
           ELSE COALESCE(CAST(agency_subelement_code AS VARCHAR), 'Unknown') END AS component_code
    FROM accessions
    WHERE (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
      AND (${selectedSub} = 'All Components' OR CAST(agency_subelement_code AS VARCHAR) = ${selectedSub})
      AND (${selectedVet} = 'All' OR veteran_indicator = CAST(${selectedVet} AS BOOLEAN))
      AND (${selectedStem} = 'All' OR CAST(stem_occupation_type AS VARCHAR) = ${selectedStem})
      AND (${selectedAccCat} = 'All' OR CAST(accession_category_code AS VARCHAR) = ${selectedAccCat})
      AND (${selectedSup} = 'All' OR CAST(supervisory_status_code AS VARCHAR) = ${selectedSup})
      AND (${selectedAge} = 'All' OR CAST(age_bracket AS VARCHAR) = ${selectedAge})
      AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), CAST(occupational_series_code AS VARCHAR)))
    GROUP BY component_code
    ORDER BY COUNT(*) DESC
    LIMIT 20
  )
  SELECT 
    CASE WHEN ${selectedAgency} = 'All Agencies' THEN COALESCE(CAST(agency_code AS VARCHAR), 'Unknown')
         ELSE COALESCE(CAST(agency_subelement_code AS VARCHAR), 'Unknown') END AS component_code,
    CASE 
      WHEN (supervisory_status_code IS NOT NULL AND CAST(supervisory_status_code AS VARCHAR) != '8')
        OR pay_plan_code IN ('ES', 'SL', 'ST') 
      THEN 'Leadership'
      ELSE 'Non-Leadership'
    END AS leadership_status,
    COUNT(*) AS count
  FROM accessions
  WHERE (CASE WHEN ${selectedAgency} = 'All Agencies' THEN COALESCE(CAST(agency_code AS VARCHAR), 'Unknown')
              ELSE COALESCE(CAST(agency_subelement_code AS VARCHAR), 'Unknown') END) IN (SELECT component_code FROM TopComponents)
    AND (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR CAST(agency_subelement_code AS VARCHAR) = ${selectedSub})
    AND (${selectedVet} = 'All' OR veteran_indicator = CAST(${selectedVet} AS BOOLEAN))
    AND (${selectedStem} = 'All' OR CAST(stem_occupation_type AS VARCHAR) = ${selectedStem})
    AND (${selectedAccCat} = 'All' OR CAST(accession_category_code AS VARCHAR) = ${selectedAccCat})
    AND (${selectedSup} = 'All' OR CAST(supervisory_status_code AS VARCHAR) = ${selectedSup})
    AND (${selectedAge} = 'All' OR CAST(age_bracket AS VARCHAR) = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), CAST(occupational_series_code AS VARCHAR)))
  GROUP BY component_code, leadership_status
`;

const componentDataClean = Array.from(componentData, d => ({
  Organization: getDesc(isAgencyLevel ? 'agency' : 'agency_subelement', d.component_code),
  Role: d.leadership_status,
  Accessions: Number(d.count)
}));

const componentChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.25);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
    width,
    marginLeft: safeMarginLeft, 
    marginRight: 40,
    marginBottom: 40, 
    x: { label: "Total Accessions", grid: true },
    y: { 
      label: null, 
      sort: { y: "-x" },
      tickFormat: (d) => truncate(d, maxChars)
    },
    color: { 
      legend: true, 
      domain: ["Leadership", "Non-Leadership"],
      range: ["#f59e0b", "#0ea5e9"] 
    },
    marks: [
      Plot.barX(componentDataClean, { 
        x: "Accessions", 
        y: "Organization", 
        fill: "Role", 
        order: "sum", 
        tip: true 
      }),
      Plot.ruleX([0])
    ]
  });
});
```

```js
// 7. Chart: Accessions by Month and Type
const monthlyData = await db.sql`
  SELECT 
    date_trunc('month', CAST(personnel_action_effective_date_yyyymm AS DATE)) AS Month, 
    CAST(accession_category_code AS VARCHAR) AS accession_category_code,
    COUNT(*) AS count
  FROM accessions
  WHERE (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR CAST(agency_subelement_code AS VARCHAR) = ${selectedSub})
    AND (${selectedVet} = 'All' OR veteran_indicator = CAST(${selectedVet} AS BOOLEAN))
    AND (${selectedStem} = 'All' OR CAST(stem_occupation_type AS VARCHAR) = ${selectedStem})
    AND (${selectedAccCat} = 'All' OR CAST(accession_category_code AS VARCHAR) = ${selectedAccCat})
    AND (${selectedSup} = 'All' OR CAST(supervisory_status_code AS VARCHAR) = ${selectedSup})
    AND (${selectedAge} = 'All' OR CAST(age_bracket AS VARCHAR) = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), CAST(occupational_series_code AS VARCHAR)))
    AND accession_category_code IS NOT NULL
    AND personnel_action_effective_date_yyyymm IS NOT NULL
  GROUP BY Month, accession_category_code
  ORDER BY Month
`;

const formatMonth = (d) => d ? new Date(d).toLocaleDateString("en-US", { 
  timeZone: "UTC", month: "short", year: "numeric" 
}) : "Unknown";

const monthlyDataClean = Array.from(monthlyData, d => ({
  Month: d.Month,
  Category: getDesc('accession_category', d.accession_category_code),
  Accessions: Number(d.count)
}));

const accessionsChart = resize((width) => Plot.plot({
  width, 
  marginBottom: 40, 
  x: { 
    label: null, 
    tickFormat: formatMonth,
    tickRotate: -45
  },
  y: { label: "Accessions", grid: true },
  color: { 
    legend: true, 
    label: "Category",
    scheme: "observable10"
  },
  marks: [
    Plot.barY(monthlyDataClean, { 
      x: "Month", 
      y: "Accessions", 
      fill: "Category", 
      tip: { format: { x: formatMonth } } 
    }),
    Plot.ruleY([0])
  ]
}));
```

```js
// 8. Data Table
const tableData = await db.sql`
  SELECT
    CAST(agency_code AS VARCHAR) AS Agency,
    CAST(agency_subelement_code AS VARCHAR) AS Component,
    CAST(occupational_series_code AS VARCHAR) AS JobSeries,
    CAST(supervisory_status_code AS VARCHAR) AS SupervisoryStatus,
    length_of_service_years AS PriorTenure, 
    CAST(age_bracket AS VARCHAR) AS Age,
    annualized_adjusted_basic_pay AS Salary,
    CAST(accession_category_code AS VARCHAR) AS AccessionType,
    CAST(stem_occupation_type AS VARCHAR) AS STEMType,
    CAST(veteran_indicator AS VARCHAR) AS Veteran,
    strftime(CAST(personnel_action_effective_date_yyyymm AS DATE), '%m/%Y') AS AccessionMonth
  FROM accessions
  WHERE (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR CAST(agency_subelement_code AS VARCHAR) = ${selectedSub})
    AND (${selectedVet} = 'All' OR veteran_indicator = CAST(${selectedVet} AS BOOLEAN))
    AND (${selectedStem} = 'All' OR CAST(stem_occupation_type AS VARCHAR) = ${selectedStem})
    AND (${selectedAccCat} = 'All' OR CAST(accession_category_code AS VARCHAR) = ${selectedAccCat})
    AND (${selectedSup} = 'All' OR CAST(supervisory_status_code AS VARCHAR) = ${selectedSup})
    AND (${selectedAge} = 'All' OR CAST(age_bracket AS VARCHAR) = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), CAST(occupational_series_code AS VARCHAR)))
  LIMIT 500
`;

const dataTable = Inputs.table(tableData, { 
  layout: "auto",
  format: {
    Agency: d => getDesc("agency", d),
    Component: d => getDesc("agency_subelement", d),
    JobSeries: d => getDesc("occupational_series", d),
    AccessionType: d => getDesc("accession_category", d),
    SupervisoryStatus: d => getDesc("supervisory_status", d),
    Salary: d => d == null ? "N/A" : d3.format("$,.0f")(d)
  }
});

const csvContent = d3.csvFormat(Array.from(tableData));
const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
const downloadUrl = URL.createObjectURL(blob);
const downloadButton = html`<a href="${downloadUrl}" download="opm_accessions.csv" style="display: inline-block; padding: 6px 12px; background: var(--theme-foreground-focus); color: var(--theme-background); text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 14px;">
  <span style="margin-right: 6px;">⬇️</span> Download CSV
</a>`;
```

```js
// 9. Chart: Career Level and Hiring Mechanism
const eligibilityData = await db.sql`
  SELECT 
    CASE 
      WHEN TRY_CAST(length_of_service_years AS FLOAT) = 0 THEN 'Entry Level (0 Yrs)'
      WHEN TRY_CAST(length_of_service_years AS FLOAT) < 5 THEN 'Early Career (<5 Yrs)'
      WHEN TRY_CAST(length_of_service_years AS FLOAT) < 15 THEN 'Mid Career (5-14 Yrs)'
      ELSE 'Late Career (15+ Yrs)'
    END AS experience_tier,
    CAST(accession_category_code AS VARCHAR) AS accession_category_code,
    COUNT(*) AS count
  FROM accessions
  WHERE (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR CAST(agency_subelement_code AS VARCHAR) = ${selectedSub})
    AND (${selectedVet} = 'All' OR veteran_indicator = CAST(${selectedVet} AS BOOLEAN))
    AND (${selectedStem} = 'All' OR CAST(stem_occupation_type AS VARCHAR) = ${selectedStem})
    AND (${selectedAccCat} = 'All' OR CAST(accession_category_code AS VARCHAR) = ${selectedAccCat})
    AND (${selectedSup} = 'All' OR CAST(supervisory_status_code AS VARCHAR) = ${selectedSup})
    AND (${selectedAge} = 'All' OR CAST(age_bracket AS VARCHAR) = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), CAST(occupational_series_code AS VARCHAR)))
    AND length_of_service_years IS NOT NULL
  GROUP BY experience_tier, accession_category_code
`;

const eligibilityDataClean = Array.from(eligibilityData, d => ({
  "Experience Level": d.experience_tier,
  Category: getDesc('accession_category', d.accession_category_code),
  Accessions: Number(d.count)
}));

const eligibilityChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.2);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
    width,
    marginLeft: safeMarginLeft, 
    marginRight: 40,
    marginBottom: 40,
    x: { label: "Total Accessions", grid: true },
    y: { label: null,
         sort: { y: "x", reverse: true },
         tickFormat: (d) => truncate(d, maxChars)
       },
    color: { 
      legend: true,
      scheme: "observable10",
      label: "Category"
    },
    marks: [
      Plot.barX(eligibilityDataClean, { 
        x: "Accessions", 
        y: "Experience Level", 
        fill: "Category", 
        order: "sum", 
        tip: true 
      }),
      Plot.ruleX([0])
    ]
  });
});
```

```js
// 10. Chart: Distribution by Occupational Group and Series
const occGroupData = await db.sql`
  WITH TopGroups AS (
    SELECT 
      COALESCE(CAST(occupational_group_code AS VARCHAR), 'Unknown') AS occ_group_code, 
      COUNT(*) as total
    FROM accessions
    WHERE (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
      AND (${selectedSub} = 'All Components' OR CAST(agency_subelement_code AS VARCHAR) = ${selectedSub})
      AND (${selectedVet} = 'All' OR veteran_indicator = CAST(${selectedVet} AS BOOLEAN))
      AND (${selectedStem} = 'All' OR CAST(stem_occupation_type AS VARCHAR) = ${selectedStem})
      AND (${selectedAccCat} = 'All' OR CAST(accession_category_code AS VARCHAR) = ${selectedAccCat})
      AND (${selectedSup} = 'All' OR CAST(supervisory_status_code AS VARCHAR) = ${selectedSup})
      AND (${selectedAge} = 'All' OR CAST(age_bracket AS VARCHAR) = ${selectedAge})
      AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), CAST(occupational_series_code AS VARCHAR)))
    GROUP BY occ_group_code
    ORDER BY total DESC
    LIMIT 20
  )
  SELECT 
    COALESCE(CAST(occupational_group_code AS VARCHAR), 'Unknown') AS occ_group_code,
    COALESCE(CAST(occupational_series_code AS VARCHAR), 'Unknown') AS occ_series_code,
    COUNT(*) AS count
  FROM accessions
  WHERE COALESCE(CAST(occupational_group_code AS VARCHAR), 'Unknown') IN (SELECT occ_group_code FROM TopGroups)
    AND (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR CAST(agency_subelement_code AS VARCHAR) = ${selectedSub})
    AND (${selectedVet} = 'All' OR veteran_indicator = CAST(${selectedVet} AS BOOLEAN))
    AND (${selectedStem} = 'All' OR CAST(stem_occupation_type AS VARCHAR) = ${selectedStem})
    AND (${selectedAccCat} = 'All' OR CAST(accession_category_code AS VARCHAR) = ${selectedAccCat})
    AND (${selectedSup} = 'All' OR CAST(supervisory_status_code AS VARCHAR) = ${selectedSup})
    AND (${selectedAge} = 'All' OR CAST(age_bracket AS VARCHAR) = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), CAST(occupational_series_code AS VARCHAR)))
  GROUP BY occ_group_code, occ_series_code
`;

const occGroupDataClean = Array.from(occGroupData, d => ({
  "Job Group": getDesc('occupational_group', d.occ_group_code),
  "Specific Series": getDesc('occupational_series', d.occ_series_code),
  Accessions: Number(d.count)
}));

const occGroupChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.25);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
    width,
    marginLeft: safeMarginLeft, 
    marginRight: 40,
    marginBottom: 40,
    x: { label: "Total Accessions", grid: true },
    y: { 
      label: null, 
      sort: { y: "-x" },
      tickFormat: (d) => truncate(d, maxChars)
    },
    color: { scheme: "observable10" }, 
    marks: [
      Plot.barX(occGroupDataClean, { 
        x: "Accessions", 
        y: "Job Group", 
        fill: "Specific Series", 
        order: "sum", 
        stroke: "var(--theme-background)", 
        strokeWidth: 0.5,
        tip: true
      }),
      Plot.ruleX([0])
    ]
  });
});
```

```js
// 11. Chart: Prior Service by Age Bracket
const smeData = await db.sql`
  SELECT 
    length_of_service_years,
    age_bracket,
    occupational_series_code,
    pay_plan_code || '-' || grade AS grade_level,
    annualized_adjusted_basic_pay
  FROM accessions
  WHERE length_of_service_years IS NOT NULL
    AND annualized_adjusted_basic_pay IS NOT NULL
    AND age_bracket IS NOT NULL
    AND (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR CAST(agency_subelement_code AS VARCHAR) = ${selectedSub})
    AND (${selectedVet} = 'All' OR veteran_indicator = CAST(${selectedVet} AS BOOLEAN))
    AND (${selectedStem} = 'All' OR CAST(stem_occupation_type AS VARCHAR) = ${selectedStem})
    AND (${selectedAccCat} = 'All' OR CAST(accession_category_code AS VARCHAR) = ${selectedAccCat})
    AND (${selectedSup} = 'All' OR CAST(supervisory_status_code AS VARCHAR) = ${selectedSup})
    AND (${selectedAge} = 'All' OR CAST(age_bracket AS VARCHAR) = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), CAST(occupational_series_code AS VARCHAR)))
`;

const smeChart = (() => {
  const data = Array.from(smeData, d => ({
    tenure: d.length_of_service_years,
    age: d.age_bracket,
    occupation: getDesc('occupational_series', d.occupational_series_code)
  }));

  if (data.length === 0) return html`<div style="padding: 1rem; color: var(--theme-foreground-muted);">No data available for the selected filters.</div>`;

  // Sort age brackets logically from youngest to oldest
  const ageDomain = [...new Set(data.map(d => d.age))].sort((a, b) => {
    if (a.includes("LESS THAN")) return -1;
    if (b.includes("LESS THAN")) return 1;
    if (a.includes("MORE")) return 1;
    if (b.includes("MORE")) return -1;
    return a.localeCompare(b, undefined, {numeric: true});
  });

  return resize((width) => Plot.plot({
    width,
    height: 450, // Resized to fit standard dashboard proportions
    marginLeft: 60,
    marginBottom: 60,
    grid: true,
    fx: { 
      domain: ageDomain, 
      label: null, 
      tickRotate: -45, // Rotates labels to prevent overlap
      padding: 0.05
    },
    y: { label: "Prior Service (Years)" },
    color: { scheme: "observable10" },
    marks: [
      Plot.frame({ strokeOpacity: 0.2 }), // Light box around each age facet
      Plot.boxY(data, {
        fx: "age",
        y: "tenure",
        fill: "age",
        tip: true
      })
    ]
  }));
})();
```

```js
// 12. Chart: Prior Service by Accession Type
const serviceData = await db.sql`
  SELECT 
    CAST(accession_category_code AS VARCHAR) AS accession_category_code,
    TRY_CAST(length_of_service_years AS FLOAT) AS length_of_service_years
  FROM accessions
  WHERE length_of_service_years IS NOT NULL
    AND (${selectedAgency} = 'All Agencies' OR CAST(agency_code AS VARCHAR) = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR CAST(agency_subelement_code AS VARCHAR) = ${selectedSub})
    AND (${selectedVet} = 'All' OR veteran_indicator = CAST(${selectedVet} AS BOOLEAN))
    AND (${selectedStem} = 'All' OR CAST(stem_occupation_type AS VARCHAR) = ${selectedStem})
    AND (${selectedAccCat} = 'All' OR CAST(accession_category_code AS VARCHAR) = ${selectedAccCat})
    AND (${selectedSup} = 'All' OR CAST(supervisory_status_code AS VARCHAR) = ${selectedSup})
    AND (${selectedAge} = 'All' OR CAST(age_bracket AS VARCHAR) = ${selectedAge})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), CAST(occupational_series_code AS VARCHAR)))
`;

const serviceDataClean = Array.from(serviceData, d => ({
  "Prior Service (Years)": d.length_of_service_years,
  Category: getDesc('accession_category', d.accession_category_code)
}));

const serviceChart = resize((width) => {
  const safeMarginLeft = Math.max(40, width * 0.2);
  const maxChars = Math.floor(safeMarginLeft / 6.5);

  return Plot.plot({
    width,
    marginLeft: safeMarginLeft, 
    marginRight: 40,
    marginBottom: 40,
    x: { label: "Length of Service (Years)", grid: true },
    y: { 
      label: null,
      tickFormat: (d) => truncate(d, maxChars)
    },
    color: { scheme: "observable10" },
    marks: [
      Plot.boxX(serviceDataClean, { 
        x: "Prior Service (Years)", 
        y: "Category", 
        fill: "Category",
        tip: { format: { fill: false } },
        clip: true
      })
    ]
  });
});
```

<div class="grid grid-cols-3">
  <div class="card" style="display: flex; flex-direction: column; gap: 1rem;">
    ${agencyInput}
    ${subInput}
    ${stemInput}
    ${accCatInput}
    ${supInput}
    ${ageInput}
  </div>
  <div class="card occ-card" style="grid-column: span 2; display: flex; flex-direction: column; gap: 1rem;">
    ${occInput}
    <div style="display: flex; gap: 2rem;">
    ${vetInput}
    </div>
  </div>
</div>

<div class="grid grid-cols-3">
  <div class="card">
    <h2>Total Accessions</h2>
    <span class="big">${Number(metrics.total_employees).toLocaleString()}</span>
    ${leadershipSplitHtml}
  </div>
  <div class="card">
    <h2>Average Salary</h2>
    <span class="big">
      ${metrics.avg_salary != null ? metrics.avg_salary.toLocaleString("en-US", {style: "currency", currency: "USD", maximumFractionDigits: 0}) : "N/A"}
    </span>
    ${salarySplitHtml}
  </div>
  <div class="card">
    <h2>Average Prior Service (Years)</h2>
    <span class="big">
      ${metrics.avg_tenure != null ? metrics.avg_tenure.toFixed(1) : "N/A"}
    </span>
    ${tenureSplitHtml}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h3>Accessions by Agency & Leadership Status (Top 20)</h3>
    ${componentChart}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h3>Prior Service by Accession Type</h3>
    <p style="color: var(--theme-foreground-muted); font-size: 0.9em; margin-top: 0;"><em>Colored box represents interquartile range with vertical bar marking the median. Whisker lines represent extreme values minus outliers, which are represented by dots. Missing box indicates insufficient data for statistical analysis.</em></p>
    ${serviceChart}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h3>Career Level v. Accession Type</h3>
    <p style="color: var(--theme-foreground-muted); font-size: 0.9em; margin-top: 0;"><em>Categorizes incoming hires by prior creditable service experience.</em></p>
    ${eligibilityChart}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h3>Distribution of Prior Service by Age Bracket</h3>
    <p style="color: var(--theme-foreground-muted); font-size: 0.9em; margin-top: 0;"><em>Whisker box plots showing the distribution of prior creditable service, partitioned by age bracket.</em></p>
    ${smeChart}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h3>Accessions by Occupational Group & Series (Top 20)</h3>
    <p style="color: var(--theme-foreground-muted); font-size: 0.9em; margin-top: 0;"><em>The broad occupational groups with the highest volume of accessions. Hover over the segments to see the specific job series.</em></p>
    ${occGroupChart}
  </div>
</div>

<div class="grid grid-cols-1">
  <div class="card">
    <h3>Accessions by Month and Type</h3>
    ${accessionsChart}
  </div>
</div>

<div class="card">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
    <h3 style="margin: 0;">Select Filtered Records</h3>
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


<details>
  <summary>Click here to see how this data was pre-processed in Jupyter Notebook</summary>
  
# Dismal Ascent: Data Pre-Processing

This notebook loads OPM accession data from multiple JSON files, filters out old records, cleans string artifacts, casts columns into native types (Dates, Booleans, Floats) for analysis in the Observable Framework, and exports the combined dataset as optimized Parquet and JSON lookup files.

## 1. Define I/O


```python
import pandas as pd
import numpy as np
import glob

json_files = glob.glob("accessions_*.json")
output_file = "opm_accessions.parquet"

print(f"Found {len(json_files)} files to process:")
for f in json_files:
    print(f" - {f}")
```

    Found 13 files to process:
     - accessions_202501_2_2026-04-12.json
     - accessions_202502_3_2026-04-12.json
     - accessions_202503_3_2026-04-12.json
     - accessions_202504_3_2026-04-12.json
     - accessions_202505_3_2026-04-12.json
     - accessions_202506_3_2026-04-12.json
     - accessions_202507_3_2026-04-12.json
     - accessions_202508_3_2026-04-12.json
     - accessions_202509_3_2026-04-12.json
     - accessions_202510_3_2026-04-12.json
     - accessions_202511_3_2026-04-12.json
     - accessions_202512_2_2026-04-12.json
     - accessions_202601_1_2026-04-12.json
    

## 2. Load JSON in Pandas


```python
dataframes = []
for file in json_files:
    try:
        df = pd.read_json(file, lines=True) 
        dataframes.append(df)
        print(f"Successfully loaded {file}")
    except Exception as e:
        print(f"Error loading {file}: {e}")

combined_df = pd.concat(dataframes, ignore_index=True)
print(f"\nTotal records loaded: {len(combined_df)}")
```

    Successfully loaded accessions_202501_2_2026-04-12.json
    Successfully loaded accessions_202502_3_2026-04-12.json
    Successfully loaded accessions_202503_3_2026-04-12.json
    Successfully loaded accessions_202504_3_2026-04-12.json
    Successfully loaded accessions_202505_3_2026-04-12.json
    Successfully loaded accessions_202506_3_2026-04-12.json
    Successfully loaded accessions_202507_3_2026-04-12.json
    Successfully loaded accessions_202508_3_2026-04-12.json
    Successfully loaded accessions_202509_3_2026-04-12.json
    Successfully loaded accessions_202510_3_2026-04-12.json
    Successfully loaded accessions_202511_3_2026-04-12.json
    Successfully loaded accessions_202512_2_2026-04-12.json
    Successfully loaded accessions_202601_1_2026-04-12.json
    
    Total records loaded: 137468
    

## 3. Remove Old Records
The OPM download files included records with personnel actions prior to January 2025. We're only interested in actions that took place between January 2025 and January 2026.


```python
if "personnel_action_effective_date_yyyymm" in combined_df.columns:
    pre_2025_mask = combined_df["personnel_action_effective_date_yyyymm"].astype(float).fillna(0).astype(int) < 202501
    invalid_count = pre_2025_mask.sum()
    print(f"Found {invalid_count} records from before January 2025. Removing them...")
    
    # Keep only valid records
    combined_df = combined_df[combined_df["personnel_action_effective_date_yyyymm"].astype(float) >= 202501].copy()
    print(f"Remaining records: {len(combined_df)}")
```

    Found 2211 records from before January 2025. Removing them...
    Remaining records: 135257
    

## 4. Clean String Artifacts
The OPM data included a variety of missing or redacted fields, which complicates data processing and analysis.


```python
missing_value_indicators = ["REDACTED", "INVALID", "NO DATA REPORTED", "NDR", "*", " "]

# Count the occurrences before they are replaced
values_to_nullify = combined_df.isin(missing_value_indicators).sum().sum()
records_affected = combined_df.isin(missing_value_indicators).any(axis=1).sum()

# Replace missing values
combined_df.replace(missing_value_indicators, np.nan, inplace=True)

# Print the results
print(f"Number of values nullified: {values_to_nullify}")
print(f"Number of records affected: {records_affected}")
```

    Number of values nullified: 1310187
    Number of records affected: 86580
    

## 5. Type Casting: Numeric Values
Standardizing data types for numeric values.


```python
numeric_cols = [
    "annualized_adjusted_basic_pay", 
    "length_of_service_years", 
    "count",
    "supervisory_status_code",
    "tenure_code",
    "position_occupation_code",
]
for col in numeric_cols:
    if col in combined_df.columns:
        combined_df[col] = pd.to_numeric(combined_df[col], errors="coerce")
```

## 6. Type Casting: Date Values as Date32
Standardizing data types for date values; Personnel action dates set to the first of their respective months.


```python
date_cols = [
    "appointment_not_to_exceed_date",
    "service_computation_date_leave"
]
for col in date_cols:
    if col in combined_df.columns:
        combined_df[col] = pd.to_datetime(combined_df[col], errors="coerce").dt.date

# Parse the YYYYMM string into a standard Date object
if "personnel_action_effective_date_yyyymm" in combined_df.columns:
    combined_df["personnel_action_effective_date_yyyymm"] = pd.to_datetime(
        combined_df["personnel_action_effective_date_yyyymm"].astype(str), 
        format="%Y%m", 
        errors="coerce"
    ).dt.date
```

## 7. Remove Wrong SCDs
Convert to pandas datetime to easily check the year, then replace with NaT (Not a Time / Null)


```python
mask_1900 = pd.to_datetime(combined_df["service_computation_date_leave"], errors="coerce").dt.year == 1900
combined_df.loc[mask_1900, "service_computation_date_leave"] = pd.NaT
print(f"Nullified {mask_1900.sum()} records with a 1900 service computation date.")
```

    Nullified 253 records with a 1900 service computation date.
    

## 8. Fix Length of Service > 100 years
The OPM data includes records with a length of service inaccurately calculated at 125 years or greater.
Recalculating by subtracting service computation date from personnel action date and setting floor at 0 years.


```python
mask_100_years = combined_df["length_of_service_years"] > 100

# Calculate the actual difference in years 
# We divide by 365.25 to properly account for leap years in the calculation
end_dates = pd.to_datetime(combined_df["personnel_action_effective_date_yyyymm"], errors="coerce")
start_dates = pd.to_datetime(combined_df["service_computation_date_leave"], errors="coerce")
calculated_years = (end_dates - start_dates).dt.days / 365.25

# Force any negative calculations to be 0
calculated_years = calculated_years.clip(lower=0)

# Replace the >100 values with our calculated difference
combined_df.loc[mask_100_years, "length_of_service_years"] = calculated_years[mask_100_years]

# Round the entire column to 1 decimal place to match the dataset's native formatting
combined_df["length_of_service_years"] = combined_df["length_of_service_years"].round(1)

# Extract the newly calculated values to find the min and max
if mask_100_years.sum() > 0:
    new_values = combined_df.loc[mask_100_years, "length_of_service_years"]
    min_val = new_values.min()
    max_val = new_values.max()
    
    print(f"Recalculated {mask_100_years.sum()} records with > 100 years of service.")
    print(f"  --> Smallest new value: {min_val} years")
    print(f"  --> Largest new value: {max_val} years")
else:
    print("No records found with > 100 years of service.")
```

    Recalculated 1354 records with > 100 years of service.
      --> Smallest new value: 0.0 years
      --> Largest new value: 40.9 years
    

## 8. Type Casting: Booleans
Standardizing boolean fields.


```python
boolean_mapping = {"Y": True, "N": False}
boolean_cols = [
    "nsftp_indicator", 
    "drp_indicator", 
    "veteran_indicator"
]
for col in boolean_cols:
    if col in combined_df.columns:
        combined_df[col] = combined_df[col].map(boolean_mapping)
        combined_df[col] = combined_df[col].astype("boolean")
```

## 9. Type Casting: Categoricals as Strings
The OPM dataset includes numberous duplicative fields for codes and their descriptors. We set all codes as strings for future use.


```python
# Find all code columns, plus any others that should strictly be text
code_cols = [col for col in combined_df.columns if col.endswith('_code')]
code_cols.extend(['grade']) # Add grade to ensure '04', '09' don't become 4.0, 9.0

for col in code_cols:
    if col in combined_df.columns:
        combined_df[col] = combined_df[col].astype(str).str.replace(r'\.0$', '', regex=True).replace('nan', np.nan)

print(f"Sanitized {len(code_cols)} identifier columns to clean strings.")
```

    Sanitized 27 identifier columns to clean strings.
    

## 10. Drop Useless Columns
The column 'count' consisted entirely of the value '1' for every row in the data. Ain't nobody got time for that.


```python
columns_to_drop = ["count"]
existing_cols_to_drop = [col for col in columns_to_drop if col in combined_df.columns]
if existing_cols_to_drop:
    combined_df.drop(columns=existing_cols_to_drop, inplace=True)
    print(f"Dropped columns: {existing_cols_to_drop}")
```

    Dropped columns: ['count']
    

## 11. Create JSON Lookup File and Drop Descriptions

To reduce the download file size in Observable and start displaying data faster, this section creates a JSON lookup file with unique coded values and drops duplicative fields before generating the parquet file. The JSON file will be used to recreate data labels in Observable.


```python
import json

# Define pairs of (Code Column, Description Column)
lookup_pairs = [
    ("accession_category_code", "accession_category"),
    ("agency_code", "agency"),
    ("agency_subelement_code", "agency_subelement"),
    ("appointment_type_code", "appointment_type"),
    ("bargaining_unit_code", "bargaining_unit"),
    ("consolidated_statistical_area_code", "consolidated_statistical_area"),
    ("core_based_statistical_area_code", "core_based_statistical_area"),
    ("duty_station_country_code", "duty_station_country"),
    ("duty_station_county_code", "duty_station_county"),
    ("duty_station_state_code", "duty_station_state"),
    ("education_level_code", "education_level"),
    ("flsa_category_code", "flsa_category"),
    ("locality_pay_area_code", "locality_pay_area"),
    ("occupational_category_code", "occupational_category"),
    ("occupational_group_code", "occupational_group"),
    ("occupational_series_code", "occupational_series"),
    ("pay_basis_code", "pay_basis"),
    ("pay_plan_code", "pay_plan"),
    ("position_occupied_code", "position_occupied"),
    ("step_or_rate_type_code", "step_or_rate_type"),
    ("supervisory_status_code", "supervisory_status"),
    ("tenure_code", "tenure"),
    ("work_schedule_code", "work_schedule")
]

lookup_dict = {}

for code_col, desc_col in lookup_pairs:
    # Ensure both columns exist to avoid KeyErrors
    if code_col in combined_df.columns and desc_col in combined_df.columns:
        
        # Keep only rows where both the code and description exist
        valid_pairs = combined_df[[code_col, desc_col]].dropna()
        
        # Drop duplicates and convert to a dictionary mapping: { "Code": "Description" }
        mapping = valid_pairs.drop_duplicates(subset=[code_col]).set_index(code_col)[desc_col].to_dict()
        
        # Store in the master dictionary using the description column name as the category key
        lookup_dict[desc_col] = mapping

# 1. Export the lookup dictionary to a JSON file for Observable
with open("xwalk.json", "w") as f:
    json.dump(lookup_dict, f, indent=2)

print("Created xwalk.json!")

# 2. Drop description columns from the main DataFrame
cols_to_drop = [desc_col for _, desc_col in lookup_pairs if desc_col in combined_df.columns]
combined_df.drop(columns=cols_to_drop, inplace=True)

print(f"Dropped {len(cols_to_drop)} redundant description columns to shrink Parquet size.")
```

    Created xwalk.json!
    Dropped 23 redundant description columns to shrink Parquet size.
    

## 12. Export to Parquet
Do the thing!


```python
combined_df.to_parquet(output_file, engine="pyarrow", index=False)
print(f"Data successfully cleaned, typed, and exported to {output_file}")
```

    Data successfully cleaned, typed, and exported to opm_accessions.parquet

</details>