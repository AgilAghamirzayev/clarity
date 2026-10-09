# Infrastructure cost and capacity

Updated 9 October 2026.

## Deployed Azure demo

The live demo runs on one Standard_E4s_v4 VM in East US: 4 vCPUs, 32 GiB RAM and a 128 GiB Standard SSD. The Azure portal quoted **$0.252/hour for compute**, approximately **$6.05/day** or **$183.96 for 730 hours**, before separately billed disk and public-IP charges. The 730-hour figure is an arithmetic estimate, not a monthly cap or a final invoice. The demo uses Azure trial credit, which does not eliminate the underlying cost.

A 22-second fresh sample took 205.2 seconds end to end. A separate report across nine calls took 241.7 seconds. [Acceptance evidence](reports/azure-acceptance-20261009.json) records the results. Models run locally on the VM, so this configuration makes no paid external inference requests. Sustained throughput, concurrent-user capacity, backup restoration and cost per audio hour have not been measured. Do not extrapolate a single short sample into a production-capacity guarantee.

## Earlier alternative hosting scenario

The following price was checked on 9 October 2026. This alternative was not purchased or benchmarked; it is separate from the deployed Azure VM.

| Component                       | Assumption                                                     |  USD/month |
| ------------------------------- | -------------------------------------------------------------- | ---------: |
| General Purpose Regular Droplet | 8 dedicated vCPUs, 32 GiB RAM, 100 GiB SSD, 6,000 GiB transfer |     252.00 |
| Weekly percentage-based backup  | 20% of server price                                            |      50.40 |
| Infrastructure subtotal         | One server with weekly backup                                  | **302.40** |

Source: [DigitalOcean's published Droplet pricing](https://www.digitalocean.com/pricing/droplets). Hourly server price is $0.375 with the listed monthly price of $252. Use the provider's capped monthly price for a full-month budget; do not multiply the hourly price by 730 and ignore the cap. Region, availability and taxes must be checked before purchase.

This candidate can be benchmarked with the repository's complete Compose deployment. It has not been provisioned. CPU inference, service memory, model files, audio retention and database backups must be measured together before confirming that this size is sufficient. The local Apple M4 Pro measurements cannot be used as this server's throughput.

The subtotal excludes taxes, domain, extra storage/egress, operations, human review and optional external inference. Zero external-model charges assumes local inference. Storage in the server price is not charged again; additional storage remains unpriced. Weekly backups alone do not establish a recovery objective or validated restoration process.

Once measured on the selected host:

- Cost per successful call = total monthly operating cost / successfully processed calls.
- Cost per processed audio hour = total monthly operating cost / successfully processed audio hours.
- Include idle provisioned time, retries and failures in cost; count only successful work in the denominator.
- Add review minutes times the team's loaded hourly rate, operations, storage and any external-model usage. Report those assumptions separately.

`cost-input.template.json` remains deliberately unfilled for unknown workload and utilization inputs. The calculator supports `meanAudioSecondsPerCall` and returns no cost per audio hour when duration is absent. A hosting quote supplies a budget, not an observed unit cost.
