-- In-app capture: keep originals at full quality, record device location and image size.
-- Device GPS comes from the browser (navigator.geolocation) at capture time: a second, independent
-- location signal next to EXIF. Both are client-side and can be spoofed; verifiers see the source.
alter table evidence_files
  add column device_lat double precision check (device_lat between -90 and 90),
  add column device_lng double precision check (device_lng between -180 and 180),
  add column device_accuracy_m double precision check (device_accuracy_m >= 0),
  add column width integer check (width > 0),
  add column height integer check (height > 0);

-- Full-resolution phone photos are often 5-15 MB: raise the bucket cap to 25 MB.
update storage.buckets set file_size_limit = 26214400 where id = 'evidence';
