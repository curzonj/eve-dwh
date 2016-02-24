#!/bin/bash

# Download from https://www.fuzzwork.co.uk/dump/
#
#       wget https://www.fuzzwork.co.uk/dump/postgres-latest.dmp.bz2

set -x
set -e

exec pg_restore --verbose --clean --no-acl --no-owner -d eve-dwh postgres-latest.dmp
