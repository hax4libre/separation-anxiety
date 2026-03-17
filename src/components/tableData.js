import {table} from "npm:@observablehq/inputs";

// Render data as table

export function TableData(data) {
    return table(data, {
    format: {
        personnel_action_effective_date_yyyymm: (x) => new Date(x).toISOString().slice(0, 7),
        appointment_not_to_exceed_date: (x) => new Date(x).toISOString().slice(0, 10),
        service_computation_date_leave: (x) => new Date(x).toISOString().slice(0, 10)
    }
 });
}