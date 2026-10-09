import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plug, Settings2 } from "lucide-react";
import { Badge, Panel } from "../../components/ui";
import { Modal } from "../../components/Modal";
import {
  disconnectDemoConnection,
  readDemoConnections,
  resetDemoConnections,
  saveDemoConnection,
  type DemoConnection,
} from "../../data/demo-connections";
import {
  integrationCatalog,
  type IntegrationDefinition,
  type IntegrationKind,
} from "./integration-catalog";
import { ConnectionForm } from "./ConnectionForm";

const queryKey = ["demo-connections"];
export function DemoConnections() {
  const client = useQueryClient();
  const [selected, setSelected] = useState<IntegrationDefinition | null>(null);
  const [message, setMessage] = useState("");
  const connections = useQuery({
    queryKey,
    queryFn: readDemoConnections,
    retry: false,
  });
  const save = useMutation({
    mutationFn: async (connection: DemoConnection) =>
      saveDemoConnection(connection),
    onSuccess: async (_, connection) => {
      await client.invalidateQueries({ queryKey });
      setSelected(null);
      setMessage(
        `${integrationCatalog.find((item) => item.kind === connection.kind)?.name}: demo connection saved. No external service was contacted.`,
      );
    },
  });
  const disconnect = useMutation({
    mutationFn: async (kind: IntegrationKind) => disconnectDemoConnection(kind),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
      setSelected(null);
      setMessage("Demo connection removed.");
    },
  });
  const reset = useMutation({
    mutationFn: async () => resetDemoConnections(),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey });
      setMessage("Demo connections have been reset.");
    },
  });
  function open(definition: IntegrationDefinition) {
    save.reset();
    disconnect.reset();
    setMessage("");
    setSelected(definition);
  }
  return (
    <>
      <Panel
        title="Integrations"
        description="Try connecting your tools. Demo connections are saved in this browser and do not send data."
      >
        {message && (
          <p className="connection-feedback" role="status">
            {message}
          </p>
        )}
        {connections.isPending && (
          <p className="panel-copy" role="status">
            Loading connections…
          </p>
        )}
        {connections.isError && (
          <div className="panel-copy">
            <p role="alert">{connections.error.message}</p>
            <button
              className="button secondary"
              onClick={() => reset.mutate()}
              disabled={reset.isPending}
            >
              Reset demo connections
            </button>
            {reset.isError && (
              <p role="alert" className="field-error">
                {reset.error.message}
              </p>
            )}
          </div>
        )}
        <div className="integration-list demo-connections">
          {integrationCatalog.map((definition) => {
            const connection = connections.data?.find(
              (item) => item.kind === definition.kind,
            );
            const Icon = definition.icon;
            return (
              <div className="integration-row" key={definition.kind}>
                <span className="category-icon">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <div className="connection-copy">
                  <h3>{definition.name}</h3>
                  <p>{definition.detail}</p>
                  {connection && (
                    <small className="connection-destination">
                      {connection.values.endpoint ||
                        connection.values.email ||
                        connection.values.channel}
                    </small>
                  )}
                </div>
                <div className="connection-controls">
                  <Badge tone={connection ? "info" : "neutral"}>
                    {connection ? "Demo connected" : "Not connected"}
                  </Badge>
                  <button
                    className={connection ? "button secondary" : "button"}
                    disabled={connections.isPending || connections.isError}
                    aria-label={`${connection ? "Configure" : "Connect"} ${definition.name}`}
                    onClick={() => open(definition)}
                  >
                    {connection ? (
                      <Settings2 size={16} aria-hidden="true" />
                    ) : (
                      <Plug size={16} aria-hidden="true" />
                    )}
                    {connection ? "Configure" : "Connect"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open && !save.isPending && !disconnect.isPending)
            setSelected(null);
        }}
        title={
          selected
            ? `${connections.data?.some((item) => item.kind === selected.kind) ? "Configure" : "Connect"} ${selected.name}`
            : "Connect a tool"
        }
        description="Set up a demo connection for this workspace."
      >
        {selected && (
          <ConnectionForm
            key={selected.kind}
            definition={selected}
            connection={connections.data?.find(
              (item) => item.kind === selected.kind,
            )}
            pending={save.isPending || disconnect.isPending}
            error={save.error?.message || disconnect.error?.message || null}
            onSave={(values) =>
              save.mutate({
                kind: selected.kind,
                values,
                updatedAt: new Date().toISOString(),
              })
            }
            onDisconnect={() => disconnect.mutate(selected.kind)}
          />
        )}
      </Modal>
    </>
  );
}
