import test from 'node:test'
import assert from 'node:assert/strict'
import React from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { NumericObservationChart } from '../src/components/observations/NumericObservationChart.tsx'
import { TextObservationTable } from '../src/components/observations/TextObservationTable.tsx'
import { ObservationResults } from '../src/components/observations/ObservationResults.tsx'
import {
  extractValidNumericPoints,
  formatNumericValue,
  formatParameterName,
  sortTextObservations,
} from '../src/components/observations/observationFormatters.ts'

const demoDevice = {
  device_uid: 'demo-device-1',
  name: 'Demonstration Machine Monitor 1',
  description: 'Simulated device for UDI modulo 4 assignment.',
}

const airTempParameter = {
  id: 1,
  name: 'air_temperature',
  data_type: 'numeric',
  unit: 'K',
}

const torqueParameterNoUnit = {
  id: 4,
  name: 'custom_ratio',
  data_type: 'numeric',
  unit: null,
}

const productTypeParameter = {
  id: 6,
  name: 'product_type',
  data_type: 'text',
  unit: null,
}

const failureStatusParameter = {
  id: 7,
  name: 'machine_failure',
  data_type: 'text',
  unit: null,
}

// ==========================================
// 1. Numeric Visualization Tests
// ==========================================

test('Numeric visualization: displays a time-series line chart for numeric parameters', () => {
  const observations = [
    {
      id: 1,
      parameter_id: 1,
      observed_at: '2025-01-01T00:00:00Z',
      numeric_value: 298.1,
      text_value: null,
      source_udi: 1,
    },
    {
      id: 2,
      parameter_id: 1,
      observed_at: '2025-01-01T00:20:00Z',
      numeric_value: 298.4,
      text_value: null,
      source_udi: 5,
    },
  ]

  const html = renderToStaticMarkup(
    React.createElement(ObservationResults, {
      observations,
      parameter: airTempParameter,
      device: demoDevice,
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-02T00:00:00Z',
      offset: 0,
      pageSize: 100,
      hasMore: false,
      onPage: () => {},
      loading: false,
    }),
  )

  assert.match(html, /<svg[^>]*class="observation-chart"/)
  assert.match(html, /class="chart-line"/)
  assert.doesNotMatch(html, /<table/)
})

test('Numeric visualization: passes timestamps and numeric values chronologically and accurately to the chart', () => {
  // Pass out-of-order observations with irregular intervals and exact decimal precision
  const observations = [
    {
      id: 3,
      parameter_id: 1,
      observed_at: '2025-01-01T02:00:00Z',
      numeric_value: 301.125,
      text_value: null,
      source_udi: 9,
    },
    {
      id: 1,
      parameter_id: 1,
      observed_at: '2025-01-01T00:00:00Z',
      numeric_value: 298.15,
      text_value: null,
      source_udi: 1,
    },
    {
      id: 2,
      parameter_id: 1,
      observed_at: '2025-01-01T00:30:00Z',
      numeric_value: 299.875,
      text_value: null,
      source_udi: 5,
    },
  ]

  const points = extractValidNumericPoints(observations)
  assert.equal(points.length, 3)
  assert.deepEqual(
    points.map((p) => p.value),
    [298.15, 299.875, 301.125],
  )

  const html = renderToStaticMarkup(
    React.createElement(NumericObservationChart, {
      observations,
      parameter: airTempParameter,
    }),
  )

  // Verify exact values appear without unnecessary rounding in tooltips and stats
  assert.match(html, /298\.15 K/)
  assert.match(html, /299\.875 K/)
  assert.match(html, /301\.125 K/)

  // Verify chronological x-coordinates on circles (0m, 30m, 120m -> uneven spacing)
  const cxMatches = [...html.matchAll(/<circle[^>]*cx="([^"]+)"/g)].map((m) => Number(m[1]))
  assert.equal(cxMatches.length, 3)
  assert.ok(cxMatches[0] < cxMatches[1] && cxMatches[1] < cxMatches[2])
  // Since 30m is 1/4 of 120m, the first interval should be 1/3 of the second interval
  const firstGap = cxMatches[1] - cxMatches[0]
  const secondGap = cxMatches[2] - cxMatches[1]
  assert.ok(Math.abs(secondGap / firstGap - 3) < 0.05)
})

test('Numeric visualization: displays selected parameter name and measurement unit where applicable', () => {
  const observations = [
    {
      id: 1,
      parameter_id: 1,
      observed_at: '2025-01-01T00:00:00Z',
      numeric_value: 298.1,
      text_value: null,
      source_udi: 1,
    },
  ]

  const withUnitHtml = renderToStaticMarkup(
    React.createElement(NumericObservationChart, {
      observations,
      parameter: airTempParameter,
    }),
  )
  assert.match(withUnitHtml, /Air Temperature/)
  assert.match(withUnitHtml, /Air Temperature \(K\)/)
  assert.match(withUnitHtml, /class="chart-unit-badge">K<\/span>/)

  const withoutUnitHtml = renderToStaticMarkup(
    React.createElement(NumericObservationChart, {
      observations,
      parameter: torqueParameterNoUnit,
    }),
  )
  assert.match(withoutUnitHtml, /Custom Ratio/)
  assert.doesNotMatch(withoutUnitHtml, /chart-unit-badge/)
  assert.doesNotMatch(withoutUnitHtml, /Custom Ratio \(/)
})

test('Numeric visualization: handles single observation dataset correctly', () => {
  const singleObservation = [
    {
      id: 10,
      parameter_id: 1,
      observed_at: '2025-01-01T04:15:00Z',
      numeric_value: 300.5,
      text_value: null,
      source_udi: 12,
    },
  ]

  const html = renderToStaticMarkup(
    React.createElement(NumericObservationChart, {
      observations: singleObservation,
      parameter: airTempParameter,
    }),
  )

  assert.match(html, /1 observation plotted chronologically/)
  assert.match(html, /<circle[^>]*r="6"/)
  assert.match(html, /300\.5 K/)
  // Should not render an invalid NaN path
  assert.doesNotMatch(html, /NaN/)
})

test('Numeric visualization: handles zero and negative values correctly', () => {
  const zeroAndNegativeObservations = [
    {
      id: 1,
      parameter_id: 4,
      observed_at: '2025-01-01T00:00:00Z',
      numeric_value: -12.5,
      text_value: null,
      source_udi: 1,
    },
    {
      id: 2,
      parameter_id: 4,
      observed_at: '2025-01-01T00:10:00Z',
      numeric_value: 0,
      text_value: null,
      source_udi: 2,
    },
    {
      id: 3,
      parameter_id: 4,
      observed_at: '2025-01-01T00:20:00Z',
      numeric_value: 8.25,
      text_value: null,
      source_udi: 3,
    },
  ]

  const html = renderToStaticMarkup(
    React.createElement(NumericObservationChart, {
      observations: zeroAndNegativeObservations,
      parameter: { id: 4, name: 'torque', data_type: 'numeric', unit: 'Nm' },
    }),
  )

  assert.match(html, /-12\.5 Nm/)
  assert.match(html, /0 Nm/)
  assert.match(html, /8\.25 Nm/)
  assert.match(html, /chart-grid--zero/)
  assert.doesNotMatch(html, /NaN/)
})

test('Numeric visualization: chart updates when new observations are received', () => {
  const firstBatch = [
    {
      id: 1,
      parameter_id: 1,
      observed_at: '2025-01-01T00:00:00Z',
      numeric_value: 297.2,
      text_value: null,
      source_udi: 1,
    },
  ]
  const secondBatch = [
    {
      id: 2,
      parameter_id: 1,
      observed_at: '2025-01-01T01:00:00Z',
      numeric_value: 304.9,
      text_value: null,
      source_udi: 5,
    },
    {
      id: 3,
      parameter_id: 1,
      observed_at: '2025-01-01T02:00:00Z',
      numeric_value: 305.6,
      text_value: null,
      source_udi: 9,
    },
  ]

  const firstHtml = renderToStaticMarkup(
    React.createElement(NumericObservationChart, {
      observations: firstBatch,
      parameter: airTempParameter,
    }),
  )
  const secondHtml = renderToStaticMarkup(
    React.createElement(NumericObservationChart, {
      observations: secondBatch,
      parameter: airTempParameter,
    }),
  )

  assert.match(firstHtml, /297\.2 K/)
  assert.doesNotMatch(firstHtml, /304\.9 K/)
  assert.match(secondHtml, /304\.9 K/)
  assert.match(secondHtml, /305\.6 K/)
  assert.doesNotMatch(secondHtml, /297\.2 K/)
})

// ==========================================
// 2. Text Visualization Tests
// ==========================================

test('Text visualization: displays a table with timestamps in the first column and text values in the second', () => {
  const observations = [
    {
      id: 10,
      parameter_id: 6,
      observed_at: '2025-01-01T00:00:00Z',
      numeric_value: null,
      text_value: 'M',
      source_udi: 1,
    },
    {
      id: 11,
      parameter_id: 6,
      observed_at: '2025-01-01T00:20:00Z',
      numeric_value: null,
      text_value: 'L',
      source_udi: 5,
    },
  ]

  const html = renderToStaticMarkup(
    React.createElement(ObservationResults, {
      observations,
      parameter: productTypeParameter,
      device: demoDevice,
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-02T00:00:00Z',
      offset: 0,
      pageSize: 100,
      hasMore: false,
      onPage: () => {},
      loading: false,
    }),
  )

  assert.match(html, /<table/)
  assert.doesNotMatch(html, /<svg[^>]*class="observation-chart"/)
  assert.match(html, /<th scope="col">Observation Timestamp<\/th>/)
  assert.match(html, /<th scope="col">Recorded Product Type<\/th>/)

  // Verify row structure: first cell is timestamp, second cell is text value
  const rowMatches = [
    ...html.matchAll(
      /<tr><td class="observation-timestamp">([^<]+)<\/td><td class="observation-text">(.*?)<\/td><\/tr>/g,
    ),
  ]
  assert.equal(rowMatches.length, 2)
  assert.match(rowMatches[0][2], />M</)
  assert.match(rowMatches[1][2], />L</)
})

test('Text visualization: displays observations in chronological order and handles repeated or missing text values', () => {
  const unorderedObservations = [
    {
      id: 22,
      parameter_id: 7,
      observed_at: '2025-01-01T01:00:00Z',
      numeric_value: null,
      text_value: 'failure',
      source_udi: 9,
    },
    {
      id: 20,
      parameter_id: 7,
      observed_at: '2025-01-01T00:00:00Z',
      numeric_value: null,
      text_value: 'normal',
      source_udi: 1,
    },
    {
      id: 21,
      parameter_id: 7,
      observed_at: '2025-01-01T00:20:00Z',
      numeric_value: null,
      text_value: 'normal',
      source_udi: 5,
    },
    {
      id: 23,
      parameter_id: 7,
      observed_at: '2025-01-01T01:20:00Z',
      numeric_value: null,
      text_value: '   ',
      source_udi: 13,
    },
  ]

  const sorted = sortTextObservations(unorderedObservations)
  assert.deepEqual(
    sorted.map((item) => item.id),
    [20, 21, 22, 23],
  )

  const html = renderToStaticMarkup(
    React.createElement(TextObservationTable, {
      observations: unorderedObservations,
      parameter: failureStatusParameter,
    }),
  )

  const cellValues = [...html.matchAll(/<td class="observation-text">(.*?)<\/td>/g)].map(
    (m) => m[1],
  )
  assert.equal(cellValues.length, 4)
  assert.match(cellValues[0], />normal</)
  assert.match(cellValues[1], />normal</)
  assert.match(cellValues[2], />failure</)
  assert.match(cellValues[3], /Not recorded/)
})

test('Text visualization: table updates when new observations are received', () => {
  const pageOne = [
    {
      id: 1,
      parameter_id: 6,
      observed_at: '2025-01-01T00:00:00Z',
      numeric_value: null,
      text_value: 'M',
      source_udi: 1,
    },
  ]
  const pageTwo = [
    {
      id: 2,
      parameter_id: 6,
      observed_at: '2025-01-01T00:20:00Z',
      numeric_value: null,
      text_value: 'H',
      source_udi: 5,
    },
  ]

  const htmlOne = renderToStaticMarkup(
    React.createElement(TextObservationTable, {
      observations: pageOne,
      parameter: productTypeParameter,
    }),
  )
  const htmlTwo = renderToStaticMarkup(
    React.createElement(TextObservationTable, {
      observations: pageTwo,
      parameter: productTypeParameter,
    }),
  )

  assert.match(htmlOne, />M</)
  assert.doesNotMatch(htmlOne, />H</)
  assert.match(htmlTwo, />H</)
  assert.doesNotMatch(htmlTwo, />M</)
})

// ==========================================
// 3. Application States, Context, & Pagination
// ==========================================

test('Application states: renders initial, loading, empty, and error states clearly', () => {
  // Initial state before any query
  const initialHtml = renderToStaticMarkup(
    React.createElement(ObservationResults, {
      observations: null,
      parameter: null,
      device: null,
      start: '2025-01-01T00:00',
      end: '2025-01-02T00:00',
      offset: 0,
      pageSize: 100,
      hasMore: false,
      onPage: () => {},
      loading: false,
    }),
  )
  assert.match(initialHtml, /Ready when you are/)
  assert.match(initialHtml, /Set your filters to get started/)
  assert.doesNotMatch(initialHtml, /<svg[^>]*class="observation-chart"/)
  assert.doesNotMatch(initialHtml, /<table/)

  // Loading state (ensuring previous observations are not shown as current)
  const loadingHtml = renderToStaticMarkup(
    React.createElement(ObservationResults, {
      observations: null,
      parameter: airTempParameter,
      device: demoDevice,
      start: '2025-01-01T00:00',
      end: '2025-01-02T00:00',
      offset: 0,
      pageSize: 100,
      hasMore: false,
      onPage: () => {},
      loading: true,
    }),
  )
  assert.match(loadingHtml, /Retrieving observations/)
  assert.match(loadingHtml, /aria-busy="true"/)
  assert.doesNotMatch(loadingHtml, /<svg[^>]*class="observation-chart"/)

  // Empty state
  const emptyHtml = renderToStaticMarkup(
    React.createElement(ObservationResults, {
      observations: [],
      parameter: airTempParameter,
      device: demoDevice,
      start: '2025-01-01T00:00',
      end: '2025-01-02T00:00',
      minimum: 310,
      maximum: 320,
      offset: 0,
      pageSize: 100,
      hasMore: false,
      onPage: () => {},
      loading: false,
    }),
  )
  assert.match(emptyHtml, /No observations found/)
  assert.doesNotMatch(emptyHtml, /<svg[^>]*class="observation-chart"/)
  assert.doesNotMatch(emptyHtml, /<table/)

  // Error state
  const errorHtml = renderToStaticMarkup(
    React.createElement(ObservationResults, {
      observations: null,
      parameter: airTempParameter,
      device: demoDevice,
      start: '2025-01-01T00:00',
      end: '2025-01-02T00:00',
      offset: 0,
      pageSize: 100,
      hasMore: false,
      onPage: () => {},
      loading: false,
      error: 'Request failed (500 Internal Server Error)',
    }),
  )
  assert.match(errorHtml, /Unable to load data/)
  assert.match(errorHtml, /Couldn’t retrieve observations/)
  assert.match(errorHtml, /Request failed \(500 Internal Server Error\)/)
})

test('Application states: switches automatically between chart and table views and displays applied filter context', () => {
  const numericObs = [
    {
      id: 1,
      parameter_id: 1,
      observed_at: '2025-01-01T00:00:00Z',
      numeric_value: 298.1,
      text_value: null,
      source_udi: 1,
    },
  ]
  const textObs = [
    {
      id: 2,
      parameter_id: 7,
      observed_at: '2025-01-01T00:00:00Z',
      numeric_value: null,
      text_value: 'normal',
      source_udi: 1,
    },
  ]

  const numericViewHtml = renderToStaticMarkup(
    React.createElement(ObservationResults, {
      observations: numericObs,
      parameter: airTempParameter,
      device: demoDevice,
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-02T00:00:00Z',
      minimum: 295.5,
      maximum: 302.5,
      offset: 0,
      pageSize: 100,
      hasMore: false,
      onPage: () => {},
      loading: false,
    }),
  )

  // Context displays device name, UID, parameter name, data type, unit, and min/max filter
  assert.match(numericViewHtml, /Demonstration Machine Monitor 1/)
  assert.match(numericViewHtml, /demo-device-1/)
  assert.match(numericViewHtml, /Air Temperature/)
  assert.match(numericViewHtml, /numeric/)
  assert.match(numericViewHtml, /Unit: K/)
  assert.match(numericViewHtml, /295\.5 to 302\.5 K/)
  assert.match(numericViewHtml, /<svg[^>]*class="observation-chart"/)

  const textViewHtml = renderToStaticMarkup(
    React.createElement(ObservationResults, {
      observations: textObs,
      parameter: failureStatusParameter,
      device: demoDevice,
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-02T00:00:00Z',
      offset: 0,
      pageSize: 100,
      hasMore: false,
      onPage: () => {},
      loading: false,
    }),
  )

  assert.match(textViewHtml, /Machine Failure/)
  assert.match(textViewHtml, /text/)
  assert.doesNotMatch(textViewHtml, /Value Filter/)
  assert.match(textViewHtml, /<table/)
})

test('Application states: handles pagination metadata and does not misrepresent partial pages as complete', () => {
  const samplePage = Array.from({ length: 100 }, (_, i) => ({
    id: i + 1,
    parameter_id: 1,
    observed_at: new Date(Date.UTC(2025, 0, 1, 0, i * 5)).toISOString(),
    numeric_value: 298 + (i % 5) * 0.2,
    text_value: null,
    source_udi: i + 1,
  }))

  let requestedOffset = null
  const firstPageHtml = renderToStaticMarkup(
    React.createElement(ObservationResults, {
      observations: samplePage,
      parameter: airTempParameter,
      device: demoDevice,
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-05T00:00:00Z',
      offset: 0,
      pageSize: 100,
      hasMore: true,
      onPage: (nextOffset) => {
        requestedOffset = nextOffset
      },
      loading: false,
    }),
  )

  assert.match(firstPageHtml, /100 ROWS SHOWN/)
  assert.match(firstPageHtml, /Page 1 · Showing 1–100/)
  assert.match(firstPageHtml, /More observations available \(displaying 100 per page\)/)
  // Previous button disabled on page 1, Next button enabled when hasMore is true
  assert.match(firstPageHtml, /<button type="button" disabled="">← Previous<\/button>/)
  assert.match(firstPageHtml, /<button type="button">Next →<\/button>/)

  const secondPageHtml = renderToStaticMarkup(
    React.createElement(ObservationResults, {
      observations: samplePage.slice(0, 25),
      parameter: airTempParameter,
      device: demoDevice,
      start: '2025-01-01T00:00:00Z',
      end: '2025-01-05T00:00:00Z',
      offset: 100,
      pageSize: 100,
      hasMore: false,
      onPage: () => {},
      loading: false,
    }),
  )

  assert.match(secondPageHtml, /25 ROWS SHOWN/)
  assert.match(secondPageHtml, /Page 2 · Showing 101–125/)
  assert.match(secondPageHtml, /End of matching observations/)
  assert.match(secondPageHtml, /<button type="button">← Previous<\/button>/)
  assert.match(secondPageHtml, /<button type="button" disabled="">Next →<\/button>/)
  assert.equal(requestedOffset, null)
})

test('Application states: handles malformed observation payloads gracefully without crashing', () => {
  const malformedNumeric = [
    {
      id: 1,
      parameter_id: 1,
      observed_at: 'not-a-timestamp',
      numeric_value: 298.1,
      text_value: null,
      source_udi: 1,
    },
    {
      id: 2,
      parameter_id: 1,
      observed_at: '2025-01-01T00:00:00Z',
      numeric_value: Number.NaN,
      text_value: null,
      source_udi: 2,
    },
  ]

  const html = renderToStaticMarkup(
    React.createElement(NumericObservationChart, {
      observations: malformedNumeric,
      parameter: airTempParameter,
    }),
  )
  assert.match(html, /No valid numeric observations were returned/)

  assert.equal(formatParameterName('rotational_speed'), 'Rotational Speed')
  assert.equal(formatNumericValue(-0), '0')
})

