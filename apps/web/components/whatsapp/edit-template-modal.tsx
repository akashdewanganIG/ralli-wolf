"use client";

import { useState, useEffect } from "react";
import { Input } from "@repo/ui/components/ui/input";
import { Textarea } from "@repo/ui/components/ui/textarea";
import { whatsappService } from "@/lib/api/services";
import { Button, SelectField } from "@repo/ui";
import { toast } from "@/lib/toast";
import { X, Plus, Trash2 } from "lucide-react";
import { WhatsAppPreview } from "./whatsapp-preview";

type ComponentType = "HEADER" | "BODY" | "FOOTER" | "BUTTONS";

type TemplateComponent = {
  type: ComponentType;
  format?: string;
  text?: string;
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
    example?: string[];
  }>;
};

type Template = {
  id: number;
  name: string;
  language: string;
  category?: string | null;
  status: string;
  components?: any;
};

interface EditTemplateModalProps {
  accountId: number;
  template: Template;
  onClose: () => void;
  onSuccess: () => void;
}

export function EditTemplateModal({
  accountId,
  template,
  onClose,
  onSuccess,
}: EditTemplateModalProps) {
  const [components, setComponents] = useState<TemplateComponent[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // Parse existing components from template
    try {
      let existingComponents: TemplateComponent[] = [];

      if (Array.isArray(template.components)) {
        existingComponents = template.components;
      } else if (
        typeof template.components === "object" &&
        template.components !== null
      ) {
        // If it's an object, try to extract components
        existingComponents = Object.values(template.components).filter(
          (c: any) => c && typeof c === "object" && c.type
        ) as TemplateComponent[];
      }

      // Ensure at least a BODY component exists
      if (existingComponents.length === 0) {
        existingComponents = [{ type: "BODY", text: "" }];
      }

      setComponents(existingComponents);
    } catch (error) {
      console.error("Failed to parse template components:", error);
      setComponents([{ type: "BODY", text: "" }]);
    }
  }, [template]);

  const addComponent = (type: ComponentType) => {
    const newComponent: TemplateComponent = {
      type,
      ...(type === "HEADER" && { format: "TEXT", text: "" }),
      ...((type === "BODY" || type === "FOOTER") && { text: "" }),
      ...(type === "BUTTONS" && { buttons: [] }),
    };

    setComponents([...components, newComponent]);
  };

  const removeComponent = (index: number) => {
    setComponents(components.filter((_, i) => i !== index));
  };

  const updateComponent = (
    index: number,
    updates: Partial<TemplateComponent>
  ) => {
    const updated = [...components];
    const component = updated[index];
    if (component) {
      updated[index] = { ...component, ...updates };
      setComponents(updated);
    }
  };

  const addButton = (componentIndex: number) => {
    const updated = [...components];
    const component = updated[componentIndex];
    if (!component) return;

    if (!component.buttons) {
      component.buttons = [];
    }
    component.buttons.push({
      type: "QUICK_REPLY",
      text: "",
    });
    setComponents(updated);
  };

  const removeButton = (componentIndex: number, buttonIndex: number) => {
    const updated = [...components];
    const component = updated[componentIndex];
    if (component?.buttons) {
      component.buttons = component.buttons.filter((_, i) => i !== buttonIndex);
    }
    setComponents(updated);
  };

  const updateButton = (
    componentIndex: number,
    buttonIndex: number,
    updates: any
  ) => {
    const updated = [...components];
    const component = updated[componentIndex];
    if (component?.buttons?.[buttonIndex]) {
      component.buttons[buttonIndex] = {
        ...component.buttons[buttonIndex],
        ...updates,
      };
      setComponents(updated);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (components.length === 0) {
      toast.error("At least one component is required");
      return;
    }

    setLoading(true);
    try {
      await whatsappService.updateTemplate(template.name, {
        accountId,
        components,
      });

      toast.success("Template updated successfully");
      onSuccess();
    } catch (error: any) {
      toast.error("Failed to update template: " + error.message);
    } finally {
      setLoading(false);
    }
  };

  const hasComponentType = (type: ComponentType) => {
    return components.some(c => c.type === type);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-foreground/45 p-4 backdrop-blur-[1px]">
      <div className="flex max-h-[calc(100svh-2rem)] w-full max-w-6xl flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-slate-950/10">
        <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-4 sm:px-6">
          <div>
            <h2 className="text-xl font-bold">Edit WhatsApp Template</h2>
            <p className="text-sm text-gray-600 mt-1">{template.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
            aria-label="Close edit template dialog"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Form Section */}
          <form
            onSubmit={handleSubmit}
            className="flex-1 p-4 space-y-4 overflow-y-auto"
          >
            {/* Template Info (Read-only) */}
            <div className="bg-gray-50 rounded p-4 space-y-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="font-medium">Language:</span>{" "}
                  <span className="uppercase">{template.language}</span>
                </div>
                <div>
                  <span className="font-medium">Category:</span>{" "}
                  <span className="capitalize">
                    {template.category || "N/A"}
                  </span>
                </div>
                <div>
                  <span className="font-medium">Status:</span>{" "}
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      template.status === "APPROVED"
                        ? "bg-green-100 text-green-800"
                        : template.status === "PENDING"
                          ? "bg-indigo-100 text-yellow-800"
                          : "bg-red-100 text-red-800"
                    }`}
                  >
                    {template.status}
                  </span>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                Note: Only components can be edited. Template name, language,
                and category cannot be changed.
              </p>
            </div>

            {/* Components */}
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-medium">Components</h3>
                <div className="flex gap-2">
                  {!hasComponentType("HEADER") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addComponent("HEADER")}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Header
                    </Button>
                  )}
                  {!hasComponentType("FOOTER") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addComponent("FOOTER")}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Footer
                    </Button>
                  )}
                  {!hasComponentType("BUTTONS") && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => addComponent("BUTTONS")}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Buttons
                    </Button>
                  )}
                </div>
              </div>

              {components.map((component, index) => (
                <div key={index} className="border rounded p-4 space-y-3">
                  <div className="flex justify-between items-center">
                    <h4 className="font-medium">{component.type}</h4>
                    {component.type !== "BODY" && (
                      <button
                        type="button"
                        onClick={() => removeComponent(index)}
                        className="text-red-500 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  {(component.type === "HEADER" ||
                    component.type === "BODY" ||
                    component.type === "FOOTER") && (
                    <div>
                      <label className="block text-sm font-medium mb-2">
                        Text
                      </label>
                      <Textarea
                        rows={3}
                        value={component.text || ""}
                        onChange={e =>
                          updateComponent(index, { text: e.target.value })
                        }
                        placeholder={`Enter ${component.type.toLowerCase()} text. Use {{1}}, {{2}} for variables.`}
                      />
                      <p className="text-xs text-gray-500 mt-1">
                        Use {`{{1}}`}, {`{{2}}`}, etc. for dynamic content
                      </p>
                    </div>
                  )}

                  {component.type === "BUTTONS" && (
                    <div className="space-y-3">
                      {component.buttons?.map((button, btnIndex) => (
                        <div
                          key={btnIndex}
                          className="border rounded p-3 space-y-2"
                        >
                          <div className="flex justify-between items-center">
                            <SelectField
                              className="w-full sm:w-40"
                              value={button.type}
                              onChange={e =>
                                updateButton(index, btnIndex, {
                                  type: e.target.value,
                                })
                              }
                            >
                              <option value="QUICK_REPLY">Quick Reply</option>
                              <option value="URL">URL</option>
                              <option value="PHONE_NUMBER">Phone Number</option>
                            </SelectField>
                            <button
                              type="button"
                              onClick={() => removeButton(index, btnIndex)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <Input
                            type="text"
                            placeholder="Button text"
                            value={button.text}
                            onChange={e =>
                              updateButton(index, btnIndex, {
                                text: e.target.value,
                              })
                            }
                          />

                          {button.type === "URL" && (
                            <Input
                              type="text"
                              placeholder="https://example.com"
                              value={button.url || ""}
                              onChange={e =>
                                updateButton(index, btnIndex, {
                                  url: e.target.value,
                                })
                              }
                            />
                          )}

                          {button.type === "PHONE_NUMBER" && (
                            <Input
                              type="text"
                              placeholder="+1234567890"
                              value={button.phone_number || ""}
                              onChange={e =>
                                updateButton(index, btnIndex, {
                                  phone_number: e.target.value,
                                })
                              }
                            />
                          )}
                        </div>
                      ))}

                      {(!component.buttons || component.buttons.length < 3) && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => addButton(index)}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          Add Button
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-3 pt-4 border-t">
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Updating..." : "Update Template"}
              </Button>
            </div>
          </form>

          {/* Preview Section */}
          <div className="w-80 border-l bg-gray-50 p-4 overflow-y-auto hidden lg:block">
            <WhatsAppPreview
              components={components}
              templateName={template.name}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
