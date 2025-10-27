"use client";

import React, { useState, useEffect } from "react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import {
  Play,
  RefreshCw,
  Settings,
  GitBranch,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader,
  Plus,
  Monitor,
  TestTube,
  Package,
  Activity,
} from "lucide-react";

const queryClient = new QueryClient();

function PipelineStage({ stage, isActive, isCompleted, isFailed, duration }) {
  const getStageIcon = (stageName) => {
    switch (stageName) {
      case "build":
        return Package;
      case "test":
        return TestTube;
      case "deploy":
        return Play;
      case "monitor":
        return Monitor;
      default:
        return Activity;
    }
  };

  const getStageColor = () => {
    if (isFailed) return "#EF4444";
    if (isCompleted) return "#10B981";
    if (isActive) return "#3B82F6";
    return "#6B7280";
  };

  const StageIcon = getStageIcon(stage.stage_name);
  const color = getStageColor();

  return (
    <div className="flex flex-col items-center relative">
      <div
        className={`w-16 h-16 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
          isActive ? "animate-pulse" : ""
        }`}
        style={{
          backgroundColor: `${color}20`,
          borderColor: color,
          boxShadow: isActive ? `0 0 20px ${color}40` : "none",
        }}
      >
        {isActive ? (
          <Loader className="animate-spin" size={24} color={color} />
        ) : (
          <StageIcon size={24} color={color} />
        )}
      </div>

      <div className="mt-3 text-center">
        <div className="font-semibold text-sm capitalize" style={{ color }}>
          {stage.stage_name}
        </div>
        {duration && (
          <div className="text-xs text-gray-500 mt-1">
            {Math.round(duration)}s
          </div>
        )}
        <div className="text-xs mt-1">
          <span
            className={`px-2 py-1 rounded-full text-white text-xs font-medium`}
            style={{ backgroundColor: color }}
          >
            {stage.status}
          </span>
        </div>
      </div>
    </div>
  );
}

function PipelineFlow({ stages }) {
  return (
    <div className="flex items-center justify-between w-full max-w-4xl mx-auto p-8">
      {stages.map((stage, index) => (
        <React.Fragment key={stage.id}>
          <PipelineStage
            stage={stage}
            isActive={stage.status === "running"}
            isCompleted={stage.status === "success"}
            isFailed={stage.status === "failed"}
            duration={stage.duration}
          />
          {index < stages.length - 1 && (
            <div className="flex-1 mx-4">
              <div
                className={`h-1 rounded-full transition-all duration-1000 ${
                  stages[index + 1].status !== "pending"
                    ? "bg-blue-500"
                    : "bg-gray-300"
                }`}
                style={{
                  background:
                    stages[index + 1].status !== "pending"
                      ? "linear-gradient(90deg, #3B82F6 0%, #10B981 100%)"
                      : "#D1D5DB",
                }}
              />
            </div>
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

function PipelineCard({ pipeline, onSelect, isSelected }) {
  const getStatusColor = (status) => {
    switch (status) {
      case "success":
        return "#10B981";
      case "failed":
        return "#EF4444";
      case "running":
        return "#3B82F6";
      default:
        return "#6B7280";
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return CheckCircle;
      case "failed":
        return XCircle;
      case "running":
        return Loader;
      default:
        return AlertCircle;
    }
  };

  const StatusIcon = getStatusIcon(pipeline.status);
  const statusColor = getStatusColor(pipeline.status);

  return (
    <div
      className={`p-4 rounded-lg border cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected
          ? "border-blue-500 bg-blue-50"
          : "border-gray-200 bg-white hover:border-gray-300"
      }`}
      onClick={() => onSelect(pipeline)}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <StatusIcon
            size={20}
            color={statusColor}
            className={pipeline.status === "running" ? "animate-spin" : ""}
          />
          <div>
            <div className="font-semibold text-gray-900">{pipeline.name}</div>
            <div className="text-sm text-gray-500 flex items-center space-x-2">
              <GitBranch size={14} />
              <span>{pipeline.branch}</span>
              {pipeline.run_number && (
                <>
                  <span>•</span>
                  <span>Run #{pipeline.run_number}</span>
                </>
              )}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div
            className="text-sm font-medium capitalize"
            style={{ color: statusColor }}
          >
            {pipeline.status}
          </div>
          {pipeline.run_started_at && (
            <div className="text-xs text-gray-500 flex items-center">
              <Clock size={12} className="mr-1" />
              {new Date(pipeline.run_started_at).toLocaleTimeString()}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Dashboard() {
  const [selectedPipeline, setSelectedPipeline] = useState(null);
  const [selectedStages, setSelectedStages] = useState([]);
  const queryClient = useQueryClient();

  // Fetch pipelines
  const { data: pipelinesData, isLoading: pipelinesLoading } = useQuery({
    queryKey: ["pipelines"],
    queryFn: async () => {
      const response = await fetch("/api/pipelines");
      if (!response.ok) throw new Error("Failed to fetch pipelines");
      return response.json();
    },
  });

  // Fetch stages for selected pipeline
  const { data: stagesData } = useQuery({
    queryKey: ["stages", selectedPipeline?.current_run_id],
    queryFn: async () => {
      if (!selectedPipeline?.current_run_id) return { stages: [] };
      const response = await fetch(
        `/api/runs/${selectedPipeline.current_run_id}/stages`,
      );
      if (!response.ok) throw new Error("Failed to fetch stages");
      return response.json();
    },
    enabled: !!selectedPipeline?.current_run_id,
  });

  // Trigger new pipeline run
  const triggerRunMutation = useMutation({
    mutationFn: async (pipelineId) => {
      const response = await fetch(`/api/pipelines/${pipelineId}/runs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ triggered_by: "dashboard-user" }),
      });
      if (!response.ok) throw new Error("Failed to trigger pipeline");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pipelines"] });
      queryClient.invalidateQueries({ queryKey: ["stages"] });
    },
  });

  const pipelines = pipelinesData?.pipelines || [];

  // Auto-select first pipeline if none selected
  useEffect(() => {
    if (pipelines.length > 0 && !selectedPipeline) {
      setSelectedPipeline(pipelines[0]);
    }
  }, [pipelines, selectedPipeline]);

  // Update stages when data changes
  useEffect(() => {
    if (stagesData?.stages) {
      setSelectedStages(stagesData.stages);
    }
  }, [stagesData]);

  const handleTriggerRun = () => {
    if (selectedPipeline) {
      triggerRunMutation.mutate(selectedPipeline.id);
    }
  };

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ["pipelines"] });
    queryClient.invalidateQueries({ queryKey: ["stages"] });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              CI/CD Pipeline Dashboard
            </h1>
            <p className="text-gray-600">
              Monitor and manage your deployment pipelines
            </p>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleRefresh}
              className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw size={16} />
              <span>Refresh</span>
            </button>
            <button className="flex items-center space-x-2 px-4 py-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors">
              <Settings size={16} />
              <span>Settings</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <div className="w-80 bg-white border-r border-gray-200 h-screen overflow-y-auto">
          <div className="p-4 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Pipelines</h2>
              <button className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <Plus size={16} />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3">
            {pipelinesLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader className="animate-spin" size={24} color="#6B7280" />
              </div>
            ) : pipelines.length === 0 ? (
              <div className="text-center py-8">
                <GitBranch size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600 mb-2">No pipelines yet</p>
                <p className="text-sm text-gray-500">
                  Add your first pipeline to get started
                </p>
              </div>
            ) : (
              pipelines.map((pipeline) => (
                <PipelineCard
                  key={pipeline.id}
                  pipeline={pipeline}
                  onSelect={setSelectedPipeline}
                  isSelected={selectedPipeline?.id === pipeline.id}
                />
              ))
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {selectedPipeline ? (
            <div className="p-6">
              {/* Pipeline Header */}
              <div className="bg-white rounded-lg border border-gray-200 p-6 mb-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold text-gray-900">
                      {selectedPipeline.name}
                    </h2>
                    <p className="text-gray-600">
                      {selectedPipeline.repository}
                    </p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <button
                      onClick={handleTriggerRun}
                      disabled={
                        triggerRunMutation.isLoading ||
                        selectedPipeline.status === "running"
                      }
                      className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      {triggerRunMutation.isLoading ? (
                        <Loader className="animate-spin" size={16} />
                      ) : (
                        <Play size={16} />
                      )}
                      <span>Run Pipeline</span>
                    </button>
                  </div>
                </div>
              </div>

              {/* Pipeline Visualization */}
              <div className="bg-white rounded-lg border border-gray-200 p-8">
                <h3 className="text-lg font-semibold text-gray-900 mb-6 text-center">
                  Pipeline Flow - Run #{selectedPipeline.run_number || "N/A"}
                </h3>

                {selectedStages.length > 0 ? (
                  <PipelineFlow stages={selectedStages} />
                ) : (
                  <div className="text-center py-12">
                    <AlertCircle
                      size={48}
                      className="mx-auto text-gray-400 mb-4"
                    />
                    <p className="text-gray-600">
                      No pipeline run data available
                    </p>
                    <p className="text-sm text-gray-500 mt-2">
                      Trigger a new run to see the pipeline visualization
                    </p>
                  </div>
                )}
              </div>

              {/* Stage Details */}
              {selectedStages.length > 0 && (
                <div className="mt-6 bg-white rounded-lg border border-gray-200 p-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">
                    Stage Details
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {selectedStages.map((stage) => (
                      <div
                        key={stage.id}
                        className="p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-medium capitalize">
                            {stage.stage_name}
                          </h4>
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium text-white`}
                            style={{
                              backgroundColor:
                                stage.status === "success"
                                  ? "#10B981"
                                  : stage.status === "failed"
                                    ? "#EF4444"
                                    : stage.status === "running"
                                      ? "#3B82F6"
                                      : "#6B7280",
                            }}
                          >
                            {stage.status}
                          </span>
                        </div>
                        {stage.duration && (
                          <p className="text-sm text-gray-600">
                            Duration: {Math.round(stage.duration)}s
                          </p>
                        )}
                        {stage.started_at && (
                          <p className="text-xs text-gray-500 mt-1">
                            Started:{" "}
                            {new Date(stage.started_at).toLocaleTimeString()}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full">
              <div className="text-center">
                <GitBranch size={48} className="mx-auto text-gray-400 mb-4" />
                <p className="text-gray-600">
                  {pipelines.length === 0
                    ? "No pipelines configured"
                    : "Select a pipeline to view details"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.7; }
        }
        
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        
        .animate-pulse {
          animation: pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
        }
        
        .animate-spin {
          animation: spin 1s linear infinite;
        }
      `}</style>
    </div>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <Dashboard />
    </QueryClientProvider>
  );
}
