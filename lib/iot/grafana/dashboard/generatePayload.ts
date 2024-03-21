// Copyright Amazon.com, Inc. or its affiliates. All Rights Reserved.
// SPDX-License-Identifier: MIT-0

type Config = {
  datasourceId: string;
  database: string;
  table: string;
  colorMappings: any;
};

export default (config: Config) => ({
  dashboard: {
    annotations: {
      list: [
        {
          builtIn: 1,
          datasource: {
            type: 'grafana',
            uid: '-- Grafana --',
          },
          enable: true,
          hide: true,
          iconColor: 'rgba(0, 211, 255, 1)',
          name: 'Annotations & Alerts',
          target: {
            limit: 100,
            matchAny: false,
            tags: [],
            type: 'dashboard',
          },
          type: 'dashboard',
        },
      ],
    },
    editable: true,
    fiscalYearStartMonth: 0,
    graphTooltip: 0,
    links: [],
    liveNow: false,
    panels: [
      {
        fieldConfig: {
          defaults: {
            color: {
              mode: 'thresholds',
            },
            mappings: [
              {
                options: {
                  Knock: {
                    index: 0,
                    text: 'Knock',
                  },
                  Speech: {
                    index: 1,
                    text: 'Speech',
                  },
                },
                type: 'value',
              },
            ],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        gridPos: {
          h: 8,
          w: 11,
          x: 0,
          y: 7,
        },
        id: 7,
        options: {
          colorMode: 'value',
          graphMode: 'area',
          justifyMode: 'auto',
          orientation: 'auto',
          reduceOptions: {
            calcs: ['lastNotNull'],
            fields: '/^class$/',
            values: false,
          },
          textMode: 'auto',
        },
        pluginVersion: '8.4.7',
        targets: [
          {
            database: config.database,
            datasource: {
              type: 'grafana-timestream-datasource',
              id: config.datasourceId,
            },
            measure: 'class',
            rawQuery:
              "SELECT * FROM $__database.$__table WHERE device_name = '$device' AND time BETWEEN from_milliseconds(${__from}) AND from_milliseconds(${__to}) ORDER BY time ASC",
            refId: 'A',
            table: config.table,
          },
        ],
        title: 'Class Detected',
        type: 'stat',
      },
      {
        fieldConfig: {
          defaults: {
            color: {
              mode: 'thresholds',
            },
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'red',
                  value: null,
                },
                {
                  color: 'green',
                  value: 40,
                },
              ],
            },
            unit: 'percent',
          },
          overrides: [],
        },
        gridPos: {
          h: 8,
          w: 10,
          x: 11,
          y: 7,
        },
        id: 3,
        options: {
          orientation: 'auto',
          reduceOptions: {
            calcs: ['last'],
            fields: '/^confidence$/',
            values: false,
          },
          showThresholdLabels: false,
          showThresholdMarkers: true,
          text: {},
        },
        pluginVersion: '8.4.7',
        targets: [
          {
            database: config.database,
            datasource: {
              type: 'grafana-timestream-datasource',
              id: config.datasourceId,
            },
            measure: 'confidence',
            rawQuery:
              "SELECT * FROM $__database.$__table WHERE device_name = '$device' AND time BETWEEN from_milliseconds(${__from}) AND from_milliseconds(${__to}) ORDER BY time ASC",
            refId: 'A',
            table: config.table,
          },
        ],
        title: 'Confidence Score',
        type: 'gauge',
      },
      {
        datasource: {
          type: 'grafana-timestream-datasource',
          id: config.datasourceId,
        },
        fieldConfig: {
          defaults: {
            color: {
              mode: 'continuous-GrYlRd',
            },
            custom: {
              fillOpacity: 70,
              lineWidth: 0,
              spanNulls: false,
            },
            mappings: [
              {
                options: config.colorMappings,
                type: 'value',
              },
            ],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        gridPos: {
          h: 7,
          w: 21,
          x: 0,
          y: 0,
        },
        id: 1,
        options: {
          alignValue: 'left',
          legend: {
            displayMode: 'list',
            placement: 'bottom',
            showLegend: true,
          },
          mergeValues: true,
          rowHeight: 0.9,
          showValue: 'auto',
          tooltip: {
            mode: 'single',
            sort: 'none',
          },
        },
        pluginVersion: '9.4.7',
        targets: [
          {
            database: config.database,
            datasource: {
              type: 'grafana-timestream-datasource',
              id: config.datasourceId,
            },
            measure: 'class',
            rawQuery:
              "SELECT class, time FROM $__database.$__table WHERE device_name = '$device' AND time BETWEEN from_milliseconds(${__from}) AND from_milliseconds(${__to}) ORDER BY time ASC",
            refId: 'A',
            table: config.table,
          },
        ],
        title: 'Visual',
        type: 'state-timeline',
      },
      {
        fieldConfig: {
          defaults: {
            color: {
              mode: 'thresholds',
            },
            custom: {
              hideFrom: {
                legend: false,
                tooltip: false,
                viz: false,
              },
            },
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        gridPos: {
          h: 8,
          w: 21,
          x: 0,
          y: 15,
        },
        id: 9,
        options: {
          basemap: {
            config: {},
            name: 'Layer 0',
            type: 'default',
          },
          controls: {
            mouseWheelZoom: true,
            showAttribution: true,
            showDebug: false,
            showScale: false,
            showZoom: true,
          },
          layers: [
            {
              config: {
                showLegend: true,
                style: {
                  color: {
                    fixed: 'dark-green',
                  },
                  opacity: 0.5,
                  rotation: {
                    fixed: 0,
                    max: 360,
                    min: -360,
                    mode: 'mod',
                  },
                  size: {
                    fixed: 7,
                    max: 15,
                    min: 2,
                  },
                  symbol: {
                    fixed: 'img/icons/marker/circle.svg',
                    mode: 'fixed',
                  },
                  textConfig: {
                    fontSize: 12,
                    offsetX: 0,
                    offsetY: 0,
                    textAlign: 'center',
                    textBaseline: 'middle',
                  },
                },
              },
              location: {
                latitude: 'lattitude',
                longitude: 'longitude',
                mode: 'coords',
              },
              name: 'marker',
              tooltip: true,
              type: 'markers',
            },
          ],
          view: {
            id: 'europe',
            lat: 46,
            lon: 14,
            zoom: 4,
          },
        },
        pluginVersion: '8.4.7',
        targets: [
          {
            database: config.database,
            datasource: {
              type: 'grafana-timestream-datasource',
              id: config.datasourceId,
            },
            measure: 'class',
            rawQuery:
              "SELECT CAST(latitude as DOUBLE) as lattitude, CAST(longitude as DOUBLE) as longitude, device_name, time FROM $__database.$__table WHERE device_name = '$device' AND time BETWEEN from_milliseconds(${__from}) AND from_milliseconds(${__to}) ORDER BY time ASC",
            refId: 'A',
            table: config.table,
          },
        ],
        title: 'Location',
        type: 'geomap',
      },
      {
        datasource: {
          type: 'grafana-timestream-datasource',
          id: config.datasourceId,
        },
        fieldConfig: {
          defaults: {
            custom: {
              align: 'auto',
              cellOptions: {
                type: 'auto',
              },
              inspect: false,
            },
            mappings: [],
            thresholds: {
              mode: 'absolute',
              steps: [
                {
                  color: 'green',
                  value: null,
                },
                {
                  color: 'red',
                  value: 80,
                },
              ],
            },
          },
          overrides: [],
        },
        gridPos: {
          h: 7,
          w: 21,
          x: 0,
          y: 15,
        },
        id: 1,
        options: {
          footer: {
            countRows: false,
            fields: '',
            reducer: ['sum'],
            show: false,
          },
          showHeader: true,
        },
        pluginVersion: '9.4.7',
        targets: [
          {
            database: config.database,
            datasource: {
              type: 'grafana-timestream-datasource',
              id: config.datasourceId,
            },
            key: 'Q-3a3019c1-e8b4-4dbb-a19d-4cd2db00d5b9-0',
            measure: 'class',
            rawQuery:
              "SELECT * FROM $__database.$__table WHERE device_name = '$device' AND time BETWEEN from_milliseconds(${__from}) AND from_milliseconds(${__to}) ORDER BY time ASC",
            refId: 'A',
            table: config.table,
            waitForResult: true,
          },
        ],
        title: 'History',
        type: 'table',
      },
    ],
    refresh: '5s',
    revision: 1,
    schemaVersion: 38,
    style: 'dark',
    tags: [],
    templating: {
      list: [
        {
          datasource: {
            type: 'grafana-timestream-datasource',
            id: config.datasourceId,
          },
          definition: 'SELECT DISTINCT device_name FROM $__database.$__table',
          hide: 0,
          includeAll: false,
          label: 'Choose Device',
          multi: false,
          name: 'device',
          options: [],
          query: 'SELECT DISTINCT device_name FROM $__database.$__table',
          refresh: 1,
          regex: '',
          skipUrlSync: false,
          sort: 0,
          type: 'query',
        },
      ],
    },
    time: {
      from: 'now-1m',
      to: 'now',
    },
    timepicker: {},
    timezone: '',
    title: 'Main',
    version: 1,
    weekStart: '',
  },
});
