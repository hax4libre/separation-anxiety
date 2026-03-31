---
title: The Before Times
theme: dashboard
---

<!-- age_bracket
agency
agency_subelement
bargaining_unit_status
length_of_service_years
occupational_series_code
position_occupied
stem_occupation_type
supervisory_status
veteran_indicator -->

# The Before Times: December 2024

Explore the federal workforce baseline heading into 2025. Use the filters below to drill down into specific agencies, components, occupations, and demographics to compare against current workforce separations and trends.

Additional charts may be added over time.

```js
import * as d3 from "npm:d3";
```

```js
// 1. Initialize DuckDB with the Before Times Parquet file
const db = await DuckDBClient.of({ 
  bt: FileAttachment("./data/bt_data.parquet") 
});
```

```js
// 2. Fetch independent global filters
const vetInput = Inputs.radio(["All", "true", "false"], { label: "Veteran Indicator:", value: "All" });
const selectedVet = Generators.input(vetInput);

const stemQuery = await db.sql`SELECT DISTINCT stem_occupation_type FROM bt WHERE stem_occupation_type IS NOT NULL ORDER BY stem_occupation_type`;
const stemOptions = ["All", ...Array.from(stemQuery, d => d.stem_occupation_type)];
const stemInput = Inputs.select(stemOptions, { label: "STEM Type:", value: "All" });
const selectedStem = Generators.input(stemInput);

const supQuery = await db.sql`SELECT DISTINCT supervisory_status FROM bt WHERE supervisory_status IS NOT NULL ORDER BY supervisory_status`;
const supOptions = ["All", ...Array.from(supQuery, d => d.supervisory_status)];
const supInput = Inputs.select(supOptions, { label: "Supervisory Status:", value: "All" });
const selectedSup = Generators.input(supInput);

const ageQuery = await db.sql`SELECT DISTINCT age_bracket FROM bt WHERE age_bracket IS NOT NULL ORDER BY age_bracket`;
const ageOptions = ["All", ...Array.from(ageQuery, d => d.age_bracket)];
const ageInput = Inputs.select(ageOptions, { label: "Age Bracket:", value: "All" });
const selectedAge = Generators.input(ageInput);

const buQuery = await db.sql`SELECT DISTINCT bargaining_unit_status FROM bt WHERE bargaining_unit_status IS NOT NULL ORDER BY bargaining_unit_status`;
const buOptions = ["All", ...Array.from(buQuery, d => d.bargaining_unit_status)];
const buInput = Inputs.select(buOptions, { label: "Bargaining Unit:", value: "All" });
const selectedBu = Generators.input(buInput);
```

```js
// 3. Agency Filter
const agencyQuery = await db.sql`
  SELECT DISTINCT agency 
  FROM bt 
  WHERE agency IS NOT NULL 
  ORDER BY agency
`;
const agencies = ["All Agencies", ...Array.from(agencyQuery, d => d.agency)];
const agencyInput = Inputs.select(agencies, { label: "Agency:", value: "All Agencies" });
const selectedAgency = Generators.input(agencyInput);
```

```js
// 4. DEPENDENT FILTER: Fetch subcomponents based on selected Agency
const subQuery = await db.sql`
  SELECT DISTINCT agency_subelement 
  FROM bt 
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND agency_subelement IS NOT NULL 
  ORDER BY agency_subelement
`;
const subelements = ["All Components", ...Array.from(subQuery, d => d.agency_subelement)];
const subelementInput = Inputs.select(subelements, { label: "Component:", value: "All Components" });
const selectedSub = Generators.input(subelementInput);
```

```js
// 5. DEPENDENT FILTER: Fetch occupations based on Agency/Component
const occQuery = await db.sql`
  SELECT DISTINCT occupational_series_code 
  FROM bt 
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR agency_subelement = ${selectedSub})
    AND occupational_series_code IS NOT NULL 
  ORDER BY occupational_series_code
`;

const occOptions = ["All", ...Array.from(occQuery, d => d.occupational_series_code)];
const occInput = Inputs.select(occOptions, { label: "Occupation Code:", multiple: true, value: ["All"] });
const selectedOcc = Generators.input(occInput);
```

```js
// 6. Reactive SQL for KPI metrics
const metricsResult = await db.sql`
  SELECT 
    COUNT(*) AS total_employees,
    AVG(length_of_service_years) AS avg_tenure,
    SUM(CASE WHEN CAST(veteran_indicator AS VARCHAR) = 'true' THEN 1 ELSE 0 END) / NULLIF(CAST(COUNT(*) AS FLOAT), 0) AS pct_vets,
    SUM(CASE WHEN supervisory_status IS NOT NULL AND supervisory_status != 'ALL OTHER POSITIONS' THEN 1 ELSE 0 END) / NULLIF(CAST(COUNT(*) AS FLOAT), 0) AS pct_supervisors,
    SUM(CASE WHEN stem_occupation_type IS NOT NULL AND stem_occupation_type != 'ALL OTHER OCCUPATIONS' THEN 1 ELSE 0 END) / NULLIF(CAST(COUNT(*) AS FLOAT), 0) AS pct_stem,
    SUM(CASE WHEN bargaining_unit_status = 'ELIGIBLE_IN_BU' THEN 1 ELSE 0 END) / NULLIF(CAST(COUNT(*) AS FLOAT), 0) AS pct_bu
  FROM bt
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR agency_subelement = ${selectedSub})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
    AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
    AND (${selectedBu} = 'All' OR bargaining_unit_status = ${selectedBu})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
`;

const metrics = Array.from(metricsResult)[0];
```

```js
// 7. Reactive SQL for Data Table
const tableData = await db.sql`
  SELECT
    agency AS Agency,
    agency_subelement AS Component,
    occupational_series_code AS JobSeriesCode,
    position_occupied AS PositionType,
    supervisory_status AS SupervisoryStatus,
    length_of_service_years AS Tenure, 
    age_bracket AS Age,
    stem_occupation_type AS STEMType,
    bargaining_unit_status AS BargainingUnit,
    veteran_indicator AS Veteran
  FROM bt
  WHERE (${selectedAgency} = 'All Agencies' OR agency = ${selectedAgency})
    AND (${selectedSub} = 'All Components' OR agency_subelement = ${selectedSub})
    AND (${selectedVet} = 'All' OR CAST(veteran_indicator AS VARCHAR) = ${selectedVet})
    AND (${selectedStem} = 'All' OR stem_occupation_type = ${selectedStem})
    AND (${selectedSup} = 'All' OR supervisory_status = ${selectedSup})
    AND (${selectedAge} = 'All' OR age_bracket = ${selectedAge})
    AND (${selectedBu} = 'All' OR bargaining_unit_status = ${selectedBu})
    AND (${selectedOcc.includes('All')} OR list_contains(string_split(${selectedOcc.join(',')}, ','), occupational_series_code))
  LIMIT 500
`;

const dataTable = Inputs.table(tableData, { layout: "auto" });

const csvContent = d3.csvFormat(Array.from(tableData));
const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
const downloadUrl = URL.createObjectURL(blob);
const downloadButton = html`<a href="${downloadUrl}" download="before_times_workforce.csv" style="display: inline-block; padding: 6px 12px; background: var(--theme-foreground-focus); color: var(--theme-background); text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 14px;">
  <span style="margin-right: 6px;">⬇️</span> Download CSV
</a>`;
```

<div class="grid grid-cols-3">
  <div class="card" style="grid-column: span 2; display: flex; flex-direction: column; gap: 1rem;">
    <div class="grid grid-cols-2" style="margin-bottom: 0;">
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${agencyInput}
        ${subelementInput}
        ${ageInput}
      </div>
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        ${supInput}
        ${stemInput}
        ${buInput}
      </div>
    </div>
    <div style="margin-top: 0.5rem;">
      ${vetInput}
    </div>
  </div>
  <div class="card occ-card" style="display: flex; flex-direction: column; gap: 1rem;">
    ${occInput}
  </div>
</div>

<div class="grid grid-cols-3">
  <div class="card">
    <h2>Total Workforce Baseline</h2>
    <span class="big">${Number(metrics.total_employees).toLocaleString()}</span>
  </div>
  <div class="card">
    <h2>Average Service (Years)</h2>
    <span class="big">
      ${metrics.avg_tenure != null ? metrics.avg_tenure.toFixed(1) : "N/A"}
    </span>
  </div>
  <div class="card">
    <h2>Veterans</h2>
    <span class="big">
      ${metrics.pct_vets != null ? (metrics.pct_vets * 100).toFixed(1) + "%" : "N/A"}
    </span>
  </div>
  <div class="card">
    <h2>Supervisors & Leadership</h2>
    <span class="big">
      ${metrics.pct_supervisors != null ? (metrics.pct_supervisors * 100).toFixed(1) + "%" : "N/A"}
    </span>
  </div>
  <div class="card">
    <h2>STEM Professionals</h2>
    <span class="big">
      ${metrics.pct_stem != null ? (metrics.pct_stem * 100).toFixed(1) + "%" : "N/A"}
    </span>
  </div>
  <div class="card">
    <h2>Bargaining Unit Eligible</h2>
    <span class="big">
      ${metrics.pct_bu != null ? (metrics.pct_bu * 100).toFixed(1) + "%" : "N/A"}
    </span>
  </div>
</div>

<div class="card" style="margin-top: 2rem;">
  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
    <h3 style="margin: 0;">Before Times Employee Sample Records</h3>
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

## The Before Times: Data Dictionary & Processing

This page focuses on record level data from OPM's Enterprise Human Resources Integration (EHRI) Status dataset from December 31, 2024. 
According to OPM, EHRI Status is a snapshot of the federal workforce on the last day of each month. 
Status data files include all active employees (in either a pay or non-pay status) for each agency's workforce as of the last day of each month.

<details>
  <summary>Click here to see review the data dictionary for this dataset.</summary>

## The Before Times: Data Dictionary

A limited subset of the dataset was retained to allow baseline comparisons with 2025 separation data. Explore the retained data types below. 

```js
// 2. Fetch the summary statistics from DuckDB
const dataSummary = await db.sql`SUMMARIZE SELECT * FROM bt`;
```

```js
// 3. Fetch exact counts and ALL frequent values for each column asynchronously
const columnsWithValues = await Promise.all(
  Array.from(dataSummary).map(async (row) => {
    // Exact total and non-null counts
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_rows, 
        COUNT("${row.column_name}") as non_null_rows 
      FROM bt
    `);
    
    // Query ALL unique values and their counts
    const allValues = await db.query(`
      SELECT "${row.column_name}" AS Value, COUNT(*) AS Count 
      FROM bt 
      GROUP BY "${row.column_name}" 
      ORDER BY Count DESC
    `);
    
    // Format the results safely so they look clean in both the quick view and the Inputs.table
    const formattedValues = Array.from(allValues).map(v => {
      let displayVal = v.Value;
      if (row.column_type === 'DATE' && v.Value !== null) {
        displayVal = new Date(Number(v.Value)).toISOString().split('T')[0];
      } else if (v.Value === null) {
        displayVal = "null"; // Passed as a string so Inputs.table handles sorting safely
      }
      return { Value: displayVal, Count: Number(v.Count) };
    });
    
    return { 
      ...row, 
      topValues: formattedValues.slice(0, 5), // Keep the top 5 for the static preview
      allValues: formattedValues, // Pass the full array for the "See all" table
      total_rows: Number(Array.from(stats)[0].total_rows),
      non_null_rows: Number(Array.from(stats)[0].non_null_rows)
    };
  })
);
```

```js
// 4. Dynamically render a clean report layout for each column
display(html`
  <div style="display: flex; flex-direction: column; gap: 1rem; margin-top: 1rem;">
    ${columnsWithValues.map(row => {
      // Bulletproof missing data calculation
      const totalCount = row.total_rows;
      const missingCount = totalCount - row.non_null_rows;
      const missingPct = totalCount > 0 ? ((missingCount / totalCount) * 100).toFixed(2) : 0;

      return html`
      <div class="card" style="padding: 1.5rem; margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-family: monospace; font-size: 1.25rem; color: var(--theme-foreground-focus);">
            ${row.column_name}
          </h3>
          ${Number(missingPct) > 1 ? html`<span title="This field may have been redacted, under reported, or inapplicable to many records." style="cursor: help; font-size: 1.25rem;">⚠️</span>` : ''}
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; font-size: 0.9rem;">
          <div>
            <span style="color: var(--theme-foreground-muted); display: block; font-size: 0.8rem; text-transform: uppercase;">Data Type</span>
            <strong style="font-family: monospace;">${row.column_type}</strong>
          </div>
          <div>
            <span style="color: var(--theme-foreground-muted); display: block; font-size: 0.8rem; text-transform: uppercase;">Approx. Unique Values</span>
            <strong>${row.approx_unique}</strong>
          </div>
          <div>
            <span style="color: var(--theme-foreground-muted); display: block; font-size: 0.8rem; text-transform: uppercase;">Missing Data</span>
            <strong>${missingCount.toLocaleString()} (${missingPct}%)</strong>
          </div>
          
          <div style="grid-column: 1 / -1; margin-top: 0.5rem;">
            <span style="color: var(--theme-foreground-muted); display: block; font-size: 0.8rem; text-transform: uppercase; margin-bottom: 0.5rem;">Most Frequent Values</span>
            
            <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--theme-foreground-faintest); padding-bottom: 4px; font-weight: 600; font-size: 0.85rem;">
              <div>Value</div>
              <div>Count</div>
            </div>
            
            ${row.topValues.map(v => html`
              <div style="display: flex; justify-content: space-between; border-bottom: 1px solid var(--theme-foreground-faintest); padding: 6px 0; font-size: 0.85rem; gap: 1rem;">
                <div style="font-family: monospace; word-break: break-word;">${v.Value !== "null" ? v.Value : html`<em>null</em>`}</div>
                <div style="text-align: right; white-space: nowrap;">${v.Count.toLocaleString()}</div>
              </div>
            `)}

            <details style="margin-top: 1rem; cursor: pointer;">
              <summary style="color: var(--theme-foreground-focus); font-weight: 600; font-size: 0.85rem;">
                See all ${row.allValues.length.toLocaleString()} unique values
              </summary>
              <div style="margin-top: 0.5rem; cursor: default;">
                ${Inputs.table(row.allValues, { 
                  rows: 10, 
                  format: { Count: d => d.toLocaleString() },
                  layout: "auto"
                })}
              </div>
            </details>

          </div>
        </div>
      </div>
    `})}
  </div>
`);
```

</details>

<details>
  <summary>Click here to see how this data was pre-processed in Jupyter Notebook</summary>

## The Before Times: Data Processing

This notebook processess raw, record level data from OPM's Enterprise Human Resources Integration (EHRI) Status dataset. 
According to OPM, EHRI Status is a snapshot of the federal workforce on the last day of each month. 
Status data files include all active employees (in either a pay or non-pay status) for each agency's workforce as of the last day of each month. 
This notebook focuses on data from December 31, 2024.

## 1. Configure I/O

```python
import pandas as pd
import numpy as np
import glob

txt_files = glob.glob("employment_*.txt")
output_file = "before_times.parquet"

print(f"Found {len(txt_files)} files to process:")
for f in txt_files:
    print(f" - {f}")
```

    Found 1 files to process:
     - employment_202412_2_2026-03-30.txt
    

## 2. Load Data in Pandas

The OPM data comes in a single, pipe-delimited text file nearing 2GB in size. 
Here we're checking for multiple files in the event we want to expand this project's scope in the future.

*NOTE: Monthly datasets will contain millions of duplicate records, so processing multiple files at once may be counterproductive. For now, we just need one.*


```python
dataframes = []
for file in txt_files:
    try:
        # Read csv into Pandas
        df = pd.read_csv(file, 
                         sep='|',            # Separate by pipes
                         engine='python',    # Use the python engine which is slower but more flexible
                         on_bad_lines='skip' # Skip lines with unexpected number of fields
                        )
        # Add the successfully loaded dataframe to the list
        dataframes.append(df)
        print(f"Successfully loaded file with {len(df)} rows")
    except Exception as e:
        print(f"Error: {e}")
        
        # On error, inspect the file
        print("\nShowing first few lines of the raw file:")
        with open("employment_202412_2_2026-03-30.txt", 'r') as f:
            for i, line in enumerate(f):
                if i < 10:  # Print first 10 lines
                    print(f"Line {i+1}: {line.strip()}")
                else:
                    break

# Check if we have any dataframes to concatenate
if dataframes:
    cdf = pd.concat(dataframes, ignore_index=True)
    print(f"\nTotal records loaded: {len(cdf)}")
else:
    print("No dataframes were successfully loaded.")
```

    Successfully loaded file with 2312301 rows
    
    Total records loaded: 2312301
    

## 3. Clean Strings

The OPM data includes a variety of missing, irrelevant, or redacted fields. 
We convert them to null for ease of processing.


```python
missing_value_indicators = ["REDACTED", "INVALID", "NO DATA REPORTED", "*", " "]

# Count the occurrences before they are replaced
values_to_nullify = cdf.isin(missing_value_indicators).sum().sum()
records_affected = cdf.isin(missing_value_indicators).any(axis=1).sum()

# Replace missing values
cdf.replace(missing_value_indicators, np.nan, inplace=True)

# Print the results
print(f"Number of values nullified: {values_to_nullify}")
print(f"Number of records affected: {records_affected}")
```

    Number of values nullified: 20447679
    Number of records affected: 1311808
    

## 4. Type Casting: Numeric Values

Standardizing numeric fields. 


```python
numeric_cols = [
    "length_of_service_years"
]
for col in numeric_cols:
    if col in cdf.columns:
        cdf[col] = pd.to_numeric(cdf[col], errors="coerce")
```

## 5. Type Casting: Dates as Date32

Standardizing date values. This field is only retained long enough to validate length of service.


```python
date_cols = [
    "service_computation_date_leave"
]
for col in date_cols:
    if col in cdf.columns:
        cdf[col] = pd.to_datetime(cdf[col], errors="coerce").dt.date
```

## 6. Remove Wrong SCDs

Convert to pandas datetime, check if the year is 1900, then replace with NaT (Not a Time, i.e., *null*)


```python
mask_1900 = pd.to_datetime(cdf["service_computation_date_leave"], errors="coerce").dt.year == 1900
cdf.loc[mask_1900, "service_computation_date_leave"] = pd.NaT
print(f"Nullified {mask_1900.sum()} records with a 1900 service computation date.")
```

    Nullified 18 records with a 1900 service computation date.
    

## 7. Fix Length of Service > 100 years

Previous OPM datasets included records with a length of service inaccurately calculated at greater than 100 years. 
We check for erroneous data and correct it by subtracting service computation date from December 31, 2024 and set a floor of 0 years.

*NOTE: `end_dates` is currently hard coded, and may need updated if this notebook is used with other datasets.*


```python
# Print the min and max values before any conversions
print("Raw Service Range:")
print(f"  --> Minimum length of service: {cdf['length_of_service_years'].min()} years")
print(f"  --> Maximum length of service: {cdf['length_of_service_years'].max()} years")
print(f"  --> Number of records with > 100 years: {(cdf['length_of_service_years'] > 100).sum()}")
print("-" * 50)

mask_100_years = cdf["length_of_service_years"] > 100

# Calculate the actual difference in years 
# We divide by 365.25 to properly account for leap years in the calculation
end_dates = pd.to_datetime('2024-12-31')  # Using December 31, 2024 as static end date
start_dates = pd.to_datetime(cdf["service_computation_date_leave"], errors="coerce")
calculated_years = (end_dates - start_dates).dt.days / 365.25

# Force any negative calculations to be 0
calculated_years = calculated_years.clip(lower=0)

# Replace the >100 values with our calculated difference
cdf.loc[mask_100_years, "length_of_service_years"] = calculated_years[mask_100_years]

# Round the entire column to 1 decimal place to match the dataset's native formatting
cdf["length_of_service_years"] = cdf["length_of_service_years"].round(1)

# Extract the newly calculated values to find the min and max
if mask_100_years.sum() > 0:
    new_values = cdf.loc[mask_100_years, "length_of_service_years"]
    min_val = new_values.min()
    max_val = new_values.max()
    
    print(f"Recalculated {mask_100_years.sum()} records with > 100 years of service.")
    print(f"  --> Smallest new value: {min_val} years")
    print(f"  --> Largest new value: {max_val} years")
else:
    print("No records found with > 100 years of service.")
```

    Raw Service Range:
      --> Minimum length of service: 0.0 years
      --> Maximum length of service: 80.3 years
      --> Number of records with > 100 years: 0
    --------------------------------------------------
    No records found with > 100 years of service.
    

## 8. Type Casting: Booleans

Standardizing boolean fields.


```python
boolean_mapping = {"Y": True, "N": False}
boolean_cols = [ 
    "veteran_indicator"
]
for col in boolean_cols:
    if col in cdf.columns:
        cdf[col] = cdf[col].map(boolean_mapping)
        cdf[col] = cdf[col].astype("boolean")
```

## 9. Type  Casting: Categoricals

Optimizing remaining object fields by evaluating whether they can be converted into categorical fields based on uniqueness. 


```python
for col in cdf.select_dtypes(include=["object"]).columns:
    if cdf[col].nunique() < 100:
        cdf[col] = cdf[col].astype("category")
```

## 10. Space Saver: Dropping Columns

This dataset is being used as a baseline reference, which only requires a small subset of the original data.

Current remaining fields for comparison include: 

- age_bracket
- agency
- agency_subelement
- bargaining_unit_status
- length_of_service_years
- occupational_series_code
- position_occupied
- stem_occupation_type
- supervisory_status
- veteran_indicator

Additional fields may be added or removed based on future needs.


```python
columns_to_drop = [
    "agency_code",
    "agency_subelement_code",
    "annualized_adjusted_basic_pay",
    "appointment_type",
    "appointment_type_code",
    "bargaining_unit",
    "bargaining_unit_code",
    "cfo_act_agency_indicator",
    "consolidated_statistical_area",
    "consolidated_statistical_area_code",
    "core_based_statistical_area",
    "core_based_statistical_area_code",
    "count",
    "duty_station_code",
    "duty_station_country",
    "duty_station_country_code",
    "duty_station_county",
    "duty_station_county_code",
    "duty_station_state",
    "duty_station_state_abbreviation",
    "duty_station_state_code",
    "duty_station_state_country_territory_code",
    "education_level",
    "education_level_bracket",
    "education_level_code",
    "flsa_category",
    "flsa_category_code",
    "grade",
    "locality_pay_area",
    "locality_pay_area_code",
    "nsftp_indicator",
    "occupational_category",
    "occupational_category_code",
    "occupational_group",
    "occupational_group_code",
    "occupational_series",
    "pay_basis",
    "pay_basis_code",
    "pay_plan",
    "pay_plan_code",
    "personnel_office_identifier_code",
    "position_occupied_code",
    "service_computation_date_leave",
    "snapshot_yyyymm",
    "stem_occupation",
    "step_or_rate_type",
    "step_or_rate_type_code",
    "supervisory_status_code",
    "tenure",
    "tenure_code",
    "work_schedule",
    "work_schedule_code"
]
existing_cols_to_drop = [col for col in columns_to_drop if col in cdf.columns]
if existing_cols_to_drop:
    cdf.drop(columns=existing_cols_to_drop, inplace=True)
    print(f"Dropped {len(existing_cols_to_drop)} columns.")
```

    Dropped 52 columns.
    

## 11. Export to Parquet

Go forth, and do great things!


```python
cdf.to_parquet(output_file, engine="pyarrow", index=False)
print(f"Data successfully cleaned, typed, and exported to {output_file}")
```

    Data successfully cleaned, typed, and exported to before_times.parquet

</details>    
