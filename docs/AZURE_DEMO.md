# Azure demo deployment

Deployed on 9 October 2026 from the current working tree, including untracked project files.

- Public demo: https://clarity.eastus.cloudapp.azure.com
- Administrator UI: https://clarity.eastus.cloudapp.azure.com/admin/
- Azure resource group: `clarity-demo-rg`
- Virtual machine: `clarity-demo-vm`, East US, `Standard_E4s_v4`, 4 vCPU and 32 GiB RAM.
- OS disk: 128 GiB Standard SSD. Approximately 98 GiB remained after installation.
- Server source directory: `/opt/clarity/release-20261009`.
- Private configuration: `.env.vps` inside the server source directory, mode 0600.

The Azure portal quoted $0.252 per hour for compute, approximately $6.05 per day. Disk and public IP are additional charges. The portal showed a $200 credit balance before deployment, expiring on 20 October 2026. This is not a live remaining-balance report. The free subscription was not upgraded.

## Demo use

Open the public URL. Each visitor receives a separate temporary workspace with eight fictional recordings, five issue groups, five recommendations and prepared reports. Choose **Try fresh analysis**, then **Analyze sample call**, to process a new 22-second recording.

The first Azure smoke test completed in 205.2 seconds: transcription and masking took 30.5 seconds, analysis 172.6 seconds and clustering 0.7 seconds. It produced nine transcript segments and one accepted finding. This is one measurement on this CPU server, not a latency guarantee or a concurrency benchmark. While analysis runs, show the prepared conversations and their evidence.

Guest sessions expire after 24 hours. A later visit can create a fresh workspace; do not rely on today's guest session retaining its changes throughout tomorrow's demo. Guest uploads and reports have the limits described in [DEPLOYMENT.md](DEPLOYMENT.md).

## Access and operation

The deployment key is stored on the deployment computer at `~/.ssh/clarity-azure-demo`; do not add it to a source archive. SSH uses `azureuser`. Only TCP 80 and 443 are public. TCP 22 is restricted to the deployment computer's public address at setup time. If that address changes, update the Azure network rule before connecting. Database, storage, queues and model APIs are internal.

Run service checks from the server source directory:

```sh
sudo docker compose --env-file .env.vps -f compose.vps.yml ps -a
sudo docker compose --env-file .env.vps -f compose.vps.yml logs --tail=50 worker api web
```

`model-init` and `ollama-init` should finish with exit code 0. The remaining services should be running. The public interface should report **Local processing available**. No administrator password is needed for the public demo. Administrator credentials remain in the private server configuration.

Services and downloaded models use persistent Docker volumes. Avoid deleting those volumes. The deployment logs are in `/opt/clarity/deploy.log`; prior failed build logs are retained separately. See [DEPLOYMENT.md](DEPLOYMENT.md) for updates and backup procedures.

The VM is left running for the demo. After the demonstration, stop it from Azure and confirm the VM is deallocated to stop compute charges. Disk and IP resources may continue to incur charges until removed. Do not delete the resource group before preserving any needed recordings or configuration.

## Deployment fixes

- The web image now includes the AI contract file imported by the existing UI.
- MinIO is built from official release source at commit `7ced9663e6a791fef9dc6be798ff24cda9c730ac`; its former container registry images were inaccessible. The running binary reports `RELEASE.2025-07-23T15-54-02Z`.
- Images are built before services start so the initializer and cleanup service can reuse the worker image.

The visual design and application behavior remain unchanged. HTTPS with a valid certificate, a fresh guest workspace, prepared audio playback, real uploaded-audio analysis, CSRF rejection and cross-visitor isolation were verified against the deployed service.
