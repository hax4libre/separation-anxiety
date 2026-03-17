---
theme: dashboard
title: Separation Anxiety
toc: false
---

```js
// Imports
import {TableData} from "./components/tableData.js";
import {PlotDepartures} from "./components/plotDepartures.js";
import {PlotCategories} from "./components/plotCategories.js";
import {PlotPay} from "./components/plotPay.js";
import {PlotDemographics} from "./components/plotDemographics.js";
import {PlotEducation} from "./components/plotEducation.js";
```

```js
// Constructors
const data = await FileAttachment("./data/opm_data.parquet").parquet();
```

```js
// Render Separations Over Time
display(PlotDepartures(data));
```

```js
// Render Types of Separation Bar Chart
display(PlotCategories(data));
```

```js
// Render Length of Service vs Pay Chart
display(PlotPay(data));
```

```js
// Render Demographics Chart
display(PlotDemographics(data));
```

```js
// Render Education Level Bar Chart
display(PlotEducation(data));
```

```js
// Render Data Table
display(TableData(data));
```