---
theme: default
title: Data Dictionary
toc: true
---

# Data Dictionary

This page builds an automated data dictionary for the OPM separation dataset. It breaks down the column types, value ranges, and missing data for all 65 fields. Users may find this page helpful when evaluating the utility of a given field for analytic purposes.

Selecting **'See all *n* unique values'** under a specific data type will return a scrollable table with a count of each value.

For further information pertaining to how OPM determines what data they redact or withhold from reporting read the [OPM Data Release Policy](https://www.opm.gov/policy-data-oversight/data-analysis-documentation/data-policy-guidance/data-standards/data-release-policy-december-2024.pdf). 

Additional information about many of the fields may be found on OPM's Enterprise Human Resources Integration [(EHRI) Data Standards site](https://data.opm.gov/data-standards/ehri-data-standards).

```js
// 1. Initialize DuckDB with Parquet file
const db = await DuckDBClient.of({ 
  opm: FileAttachment("./data/opm_data.parquet") 
});
```

```js
// 2. Fetch the summary statistics from DuckDB
const dataSummary = await db.sql`SUMMARIZE SELECT * FROM opm`;
```

```js
// 3. Fetch exact counts and ALL frequent values for each column asynchronously
const columnsWithValues = await Promise.all(
    const stats = await db.query(`
      SELECT 
        COUNT(*) as total_rows, 
        COUNT("${row.column_name}") as non_null_rows 
      FROM opm
    `);
    
    const allValues = await db.query(`
      SELECT "${row.column_name}" AS Value, COUNT(*) AS Count 
      FROM opm 
      GROUP BY "${row.column_name}" 
      ORDER BY Count DESC
    `);
    
    const formattedValues = Array.from(allValues).map(v => {
      let displayVal = v.Value;
      if (row.column_type === 'DATE' && v.Value !== null) {
        displayVal = new Date(Number(v.Value)).toISOString().split('T')[0];
      } else if (v.Value === null) {
        displayVal = "null";
      }
      return { Value: displayVal, Count: Number(v.Count) };
    });
    
    return { 
      ...row, 
      topValues: formattedValues.slice(0, 5),
      allValues: formattedValues,
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
