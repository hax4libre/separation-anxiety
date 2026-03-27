---
title: Jupyter Notebook
theme: dashboard
---

# OPM Separations Data Processing
This notebook loads OPM separation data from multiple JSON files, filters out old records, cleans string artifacts, casts columns into native types (Dates, Booleans, Floats) for analysis in the Observable Framework, and exports the combined dataset as a highly optimized Parquet file.

## 1. Define I/O


```python
import pandas as pd
import numpy as np
import glob

json_files = glob.glob("separations_*.json")
output_file = "combined_separations.parquet"

print(f"Found {len(json_files)} files to process:")
for f in json_files:
    print(f" - {f}")
```

    Found 13 files to process:
     - separations_202501_2_2026-03-11.json
     - separations_202502_3_2026-03-11.json
     - separations_202503_3_2026-03-11.json
     - separations_202504_3_2026-03-11.json
     - separations_202505_3_2026-03-11.json
     - separations_202506_3_2026-03-11.json
     - separations_202507_3_2026-03-11.json
     - separations_202508_3_2026-03-11.json
     - separations_202509_3_2026-03-11.json
     - separations_202510_3_2026-03-11.json
     - separations_202511_3_2026-03-11.json
     - separations_202512_2_2026-03-11.json
     - separations_202601_1_2026-03-11.json
    

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

    Successfully loaded separations_202501_2_2026-03-11.json
    Successfully loaded separations_202502_3_2026-03-11.json
    Successfully loaded separations_202503_3_2026-03-11.json
    Successfully loaded separations_202504_3_2026-03-11.json
    Successfully loaded separations_202505_3_2026-03-11.json
    Successfully loaded separations_202506_3_2026-03-11.json
    Successfully loaded separations_202507_3_2026-03-11.json
    Successfully loaded separations_202508_3_2026-03-11.json
    Successfully loaded separations_202509_3_2026-03-11.json
    Successfully loaded separations_202510_3_2026-03-11.json
    Successfully loaded separations_202511_3_2026-03-11.json
    Successfully loaded separations_202512_2_2026-03-11.json
    Successfully loaded separations_202601_1_2026-03-11.json
    
    Total records loaded: 398669
    

## 3. Remove Old Records
The OPM download files included approximately 1216 records with personnel actions prior to January 2025. We're only interested in departures between January 2025 and January 2026.


```python
if "personnel_action_effective_date_yyyymm" in combined_df.columns:
    pre_2025_mask = combined_df["personnel_action_effective_date_yyyymm"].astype(float).fillna(0).astype(int) < 202501
    invalid_count = pre_2025_mask.sum()
    print(f"Found {invalid_count} records from before January 2025. Removing them...")
    
    # Keep only valid records
    combined_df = combined_df[combined_df["personnel_action_effective_date_yyyymm"].astype(float) >= 202501].copy()
    print(f"Remaining records: {len(combined_df)}")
```

    Found 1216 records from before January 2025. Removing them...
    Remaining records: 397453
    

## 4. Clean String Artifacts
The OPM data included a variety of missing or redacted fields, which complicates analysis.


```python
missing_value_indicators = ["REDACTED", "INVALID", "NO DATA REPORTED", "*", " "]

# Count the occurrences before they are replaced
values_to_nullify = combined_df.isin(missing_value_indicators).sum().sum()
records_affected = combined_df.isin(missing_value_indicators).any(axis=1).sum()

# Replace missing values
combined_df.replace(missing_value_indicators, np.nan, inplace=True)

# Print the results
print(f"Number of values nullified: {values_to_nullify}")
print(f"Number of records affected: {records_affected}")
```

    Number of values nullified: 3618489
    Number of records affected: 321644
    

## 5. Type Casting: Numeric Values
Standardizing data types for numeric values.


```python
numeric_cols = [
    "annualized_adjusted_basic_pay", 
    "length_of_service_years", 
    "count",
    "supervisory_status_code",
    "tenure_code"
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

    Nullified 5 records with a 1900 service computation date.
    

## 8. Fix Length of Service > 100 years
The OPM data included over 2k records with a length of service inaccurately calculated at 125 years or greater.
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

    Recalculated 2258 records with > 100 years of service.
      --> Smallest new value: 0.0 years
      --> Largest new value: 50.0 years
    

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

## 9. Type Casting: Categoricals
Optimizing memory usage based on uniqueness of objects. Probably not needed.


```python
for col in combined_df.select_dtypes(include=["object"]).columns:
    if combined_df[col].nunique() < 100:
        combined_df[col] = combined_df[col].astype("category")
```

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
    

## 11. Export to Parquet
Do the thing!


```python
combined_df.to_parquet(output_file, engine="pyarrow", index=False)
print(f"Data successfully cleaned, typed, and exported to {output_file}")
```

    Data successfully cleaned, typed, and exported to combined_separations.parquet
    
