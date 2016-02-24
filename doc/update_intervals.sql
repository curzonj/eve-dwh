REFRESH MATERIALIZED VIEW order_frequencies;

update market_polling set

orders_polling_override = null,

history_polling_interval = COALESCE((
        case
                when f.ratio > 90 then interval '1 month'
                when f.ratio > 30 then interval '2 weeks'
                when f.ratio > 7 then interval '5 days'
                when f.ratio > 3 then interval '2 days'
                else interval '1 day' 
        end
), interval '1 month'),

orders_polling_interval = COALESCE((
        case
                when f.ratio > 180 then interval '1 month'
                when f.ratio > 90 then interval '2 weeks'
                when f.ratio > 30 then interval '1 weeks'
                when f.ratio > 7 then interval '2 days'
                when f.ratio > 2 then interval '18 hours'
                when f.avg_orders > 1000 then interval '5 minutes'
                when f.avg_orders > 700 then interval '10 minutes'
                when f.avg_orders > 100 then interval '30 minutes'
                when f.avg_orders > 50 then interval '60 minutes'
                when f.avg_orders > 10 then interval '3 hours'
                else interval '6 hours' 
        end
), interval '1 month')

from order_frequencies f where market_polling.type_id = f.type_id and market_polling.region_id = f.region_id;

update market_polling set orders_next_polling_at = current_timestamp + orders_polling_interval, history_next_polling_at = current_timestamp + history_polling_interval;
