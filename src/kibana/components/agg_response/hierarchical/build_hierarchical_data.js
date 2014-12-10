define(function (require) {
  return function buildHierarchicalDataProvider(Private) {
    var _ = require('lodash');
    var buildSplit = Private(require('components/agg_response/hierarchical/_build_split'));
    var extractBuckets = require('components/agg_response/hierarchical/_extract_buckets');
    var createRawData = require('components/agg_response/hierarchical/_create_raw_data');
    var arrayToLinkedList = require('components/agg_response/hierarchical/_array_to_linked_list');
    var tooltipFormatter = Private(require('components/agg_response/hierarchical/_hierarchical_tooltip_formatter'));

    var AggConfigResult = require('components/vis/_agg_config_result');

    return function (vis, resp) {
      // Create a refrenece to the buckets
      var buckets = vis.aggs.bySchemaGroup.buckets;


      // Find the metric so it's easier to reference.
      // TODO: Change this to support multiple metrics.
      var metric = vis.aggs.bySchemaGroup.metrics[0];

      // Link each agg to the next agg. This will be
      // to identify the next bucket aggregation
      buckets = arrayToLinkedList(buckets);

      // Create the raw data to be used in the spy panel
      var raw = createRawData(vis, resp);

      // If buckets is falsy then we should just return the aggs
      if (!buckets) {
        var value = resp.aggregations
          && resp.aggregations[metric.id]
          && resp.aggregations[metric.id].value
          || resp.hits.total;
        return {
          hits: resp.hits.total,
          raw: raw,
          names: ['_all'],
          tooltipFormatter: tooltipFormatter(raw.columns),
          slices: {
            children: [
              { name: '_all', size: value }
            ]
          }
        };
      }

      var firstAgg = buckets[0];
      var aggData = resp.aggregations[firstAgg.id];

      var convertKey = function (key) {
        if (firstAgg.params.field.format) {
          return firstAgg.params.field.format.convert(key);
        }

        return key;
      };

      // If the firstAgg is a split then we need to map
      // the split aggregations into rows.
      if (firstAgg.schema.name === 'split') {
        var rows = _.map(extractBuckets(aggData), function (bucket) {
          var agg = firstAgg._next;
          var split = buildSplit(agg, metric, bucket[agg.id]);
          // Since splits display labels we need to set it.
          split.label = convertKey(bucket.key) + ': ' + firstAgg.params.field.displayName;
          split.tooltipFormatter = tooltipFormatter(raw.columns);
          var aggConfigResult = new AggConfigResult(firstAgg, null, null, bucket.key);
          split.split = { aggConfig: firstAgg, aggConfigResult: aggConfigResult, key: bucket.key };
          _.each(split.slices.children, function (child) {
            child.aggConfigResult.$parent = aggConfigResult;
          });
          return split;
        });
        var result = { hits: resp.hits.total, raw: raw };
        if (firstAgg.params.row) {
          result.rows = rows;
        } else {
          result.columns = rows;
        }
        return result;
        // otherwise we can start at the first bucket.
      } else {
        return (function () {
          var split = buildSplit(firstAgg, metric, aggData);
          split.hits = resp.hits.total;
          split.raw = raw;
          split.tooltipFormatter = tooltipFormatter(raw.columns);
          return split;
        })();
      }

    };
  };
});