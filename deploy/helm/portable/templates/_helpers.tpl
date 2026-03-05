{{/*
Expand the name of the chart.
*/}}
{{- define "portable.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Create a default fully qualified app name.
*/}}
{{- define "portable.fullname" -}}
{{- if .Values.fullnameOverride }}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- $name := default .Chart.Name .Values.nameOverride }}
{{- if contains $name .Release.Name }}
{{- .Release.Name | trunc 63 | trimSuffix "-" }}
{{- else }}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" }}
{{- end }}
{{- end }}
{{- end }}

{{/*
Create chart name and version as used by the chart label.
*/}}
{{- define "portable.chart" -}}
{{- printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{- end }}

{{/*
Common labels.
*/}}
{{- define "portable.labels" -}}
helm.sh/chart: {{ include "portable.chart" . }}
{{ include "portable.selectorLabels" . }}
app.kubernetes.io/version: {{ .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Selector labels for the main app.
*/}}
{{- define "portable.selectorLabels" -}}
app.kubernetes.io/name: {{ include "portable.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end }}

{{/*
ServiceAccount name.
*/}}
{{- define "portable.serviceAccountName" -}}
{{ include "portable.fullname" . }}
{{- end }}

{{/*
Postgres fully qualified name.
*/}}
{{- define "portable.postgres.fullname" -}}
{{ include "portable.fullname" . }}-postgres
{{- end }}

{{/*
Postgres labels.
*/}}
{{- define "portable.postgres.labels" -}}
helm.sh/chart: {{ include "portable.chart" . }}
{{ include "portable.postgres.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.postgres.image.tag | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
{{- end }}

{{/*
Postgres selector labels.
*/}}
{{- define "portable.postgres.selectorLabels" -}}
app.kubernetes.io/name: {{ include "portable.name" . }}-postgres
app.kubernetes.io/instance: {{ .Release.Name }}
app.kubernetes.io/component: database
{{- end }}

{{/*
Secret name.
*/}}
{{- define "portable.secretName" -}}
{{ include "portable.fullname" . }}
{{- end }}

{{/*
ConfigMap name.
*/}}
{{- define "portable.configMapName" -}}
{{ include "portable.fullname" . }}-config
{{- end }}
