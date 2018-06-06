#!/usr/bin/env python3
# coding: utf-8

if __name__ != '__main__':
    import sys
    sys.exit(1)

import textblob
import json
from functools import reduce
from collections import Counter

xs = None

with open('./results.json', encoding='utf-8') as f:
    xs = json.loads(f.read())

xs = [xs[k] for k in xs]
xs = list(map(lambda x: x['#job_summary'], xs))
xs = reduce(lambda x, y: x + y, xs)

blob = textblob.TextBlob('. '.join(xs))
blob.np_counts

bag = Counter(blob.np_counts)

bag.most_common(50)
