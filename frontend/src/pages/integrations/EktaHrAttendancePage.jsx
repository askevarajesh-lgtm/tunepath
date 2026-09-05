import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Alert,
  Button,
  Card,
  DatePicker,
  Modal,
  message,
  Space,
  Switch,
  Table,
  Tag,
  Typography,
} from "antd";
import { ArrowLeftOutlined } from "@ant-design/icons";
import {
  useGetIntegrationsQuery,
  useSyncEktaAttendanceMutation,
  useSyncEktaStaffMutation,
} from "../../api/integrationApi";
import { isPresentAttendanceStatus } from "../../utils/ektaAttendanceStatus";
import dayjs from "dayjs";

const { Title, Text } = Typography;
const { MonthPicker } = DatePicker;

const formatMaybeDateTime = (value) => {
  if (!value) return "N/A";
  const d =
    typeof value === "string" || value instanceof Date ? new Date(value) : null;
  if (!d || Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleString();
};

const toYMD = (d) => {
  if (!d) return null;
  // dayjs
  if (typeof d?.format === "function") return d.format("YYYY-MM-DD");
  // moment (if used)
  if (typeof d?.toDate === "function")
    return d.toDate().toISOString().slice(0, 10);
  // native Date
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  // fallback string
  if (typeof d === "string") return d.slice(0, 10);
  return null;
};

// (Intentionally no detailed time rendering in this module)

const EktaHrAttendancePage = () => {
  const navigate = useNavigate();
  const { data } = useGetIntegrationsQuery();
  const [syncEktaAttendance, { isLoading }] = useSyncEktaAttendanceMutation();
  const [syncEktaStaff, { isLoading: staffIsLoading }] =
    useSyncEktaStaffMutation();

  const ektaIntegration = useMemo(() => {
    return data?.data?.integrations?.find((i) => i.type === "ekta") || null;
  }, [data]);

  const apiConnected = Boolean(ektaIntegration?.config?.api?.apiKey);
  const attendanceConfig = ektaIntegration?.config?.attendance || {};
  const attendanceEnabled = Boolean(attendanceConfig?.enabled);
  const attendanceEndpoint = attendanceConfig?.endpoint || "";
  const present =
    Boolean(attendanceConfig?.present) ||
    Boolean(attendanceConfig?.lastSyncedAt);

  const staffConfig = ektaIntegration?.config?.staff || {};
  const staffEnabled = Boolean(staffConfig?.enabled);
  const staffEndpoint = staffConfig?.endpoint || "";

  const [selectedMonth, setSelectedMonth] = useState(() => dayjs());

  const [fetching, setFetching] = useState(false);
  const [staffRows, setStaffRows] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);

  const staffEmployeeCode = (staff) => {
    return (
      staff?.employeeId?.employeeId ||
      staff?.employeeId ||
      staff?.employeeId?.code ||
      staff?._id ||
      ""
    );
  };

  const attendanceEmployeeCode = (record) => {
    const empId = record?.employeeId;
    if (!empId) return record?.employeeId || record?.employeeCode || "";
    if (typeof empId === "string") return empId;
    if (typeof empId === "object") return empId.employeeId || empId.code || "";
    return "";
  };

  const dateKey = (value) => {
    if (!value) return null;
    const d = dayjs(value);
    return d.isValid() ? d.format("YYYY-MM-DD") : null;
  };

  const monthDayKeys = useMemo(() => {
    const start = selectedMonth.startOf("month");
    const daysInMonth = start.daysInMonth();
    return Array.from({ length: daysInMonth }, (_, i) =>
      start.add(i, "day").format("YYYY-MM-DD"),
    );
  }, [selectedMonth]);

  const attendancePresenceMap = useMemo(() => {
    const map = new Map(); // employeeCode -> Map(dayKey -> booleanPresent)
    for (const rec of attendanceRows || []) {
      const code = attendanceEmployeeCode(rec);
      const dayKeyStr = dateKey(rec?.date || rec?.punchIn || rec?.punch_in || rec?.inTime || rec?.logIn || rec?.createdAt);
      if (!code || !dayKeyStr) continue;
      if (!map.has(code)) map.set(code, new Map());
      const dayMap = map.get(code);
      const prev = dayMap.get(dayKeyStr) === true;
      dayMap.set(dayKeyStr, prev || isPresentAttendanceStatus(rec?.status, rec));
    }
    return map;
  }, [attendanceRows]);

  const gridData = useMemo(() => {
    const rows = (staffRows || []).map((s) => {
      const code = staffEmployeeCode(s);
      const row = {
        key: code || s?._id,
        employeeName: s?.name || "",
      };

      for (const dKey of monthDayKeys) {
        const isP = attendancePresenceMap.get(code)?.get(dKey) === true;
        row[dKey] = isP ? "P" : "A";
      }
      return row;
    });

    return rows;
  }, [staffRows, monthDayKeys, attendancePresenceMap]);

  const columns = useMemo(() => {
    return [
      {
        title: "Staff",
        dataIndex: "employeeName",
        key: "employeeName",
        fixed: "left",
        width: 220,
      },
      ...monthDayKeys.map((dKey) => {
        const dayNum = dayjs(dKey).date();
        return {
          title: dayNum,
          dataIndex: dKey,
          key: dKey,
          width: 42,
          align: "center",
          render: (v) => <Tag color={v === "P" ? "green" : "default"}>{v}</Tag>,
        };
      }),
    ];
  }, [monthDayKeys]);

  const handleFetch = async () => {
    const fromDate = selectedMonth.startOf("month").format("YYYY-MM-DD");
    const toDate = selectedMonth.endOf("month").format("YYYY-MM-DD");

    if (!ektaIntegration) {
      message.warning("Ekta integration not found. Connect Ekta first.");
      return;
    }
    if (!apiConnected) {
      message.warning(
        "Ekta API is not connected. Go to Ekta HR Integration and click Get API.",
      );
      return;
    }
    if (!staffEnabled || !staffEndpoint) {
      message.warning(
        "Staff is not enabled/configured in Ekta HR Integration.",
      );
      return;
    }
    if (!attendanceEndpoint) {
      message.warning(
        "Attendance endpoint is not configured. Configure it in Ekta HR Integration.",
      );
      return;
    }

    setFetching(true);
    try {
      // 1) Fetch staff list first (email-matching done on backend).
      const staffRes = await syncEktaStaff({
        id: ektaIntegration._id,
        endpoint: staffEndpoint,
      }).unwrap();

      const staffArr = Array.isArray(staffRes?.data?.staff)
        ? staffRes.data.staff
        : [];

      setStaffRows(staffArr);

      // 2) Fetch attendance for the selected month (backend aligns to matched staff).
      const res = await syncEktaAttendance({
        id: ektaIntegration._id,
        endpoint: attendanceEndpoint,
        fromDate,
        toDate,
      }).unwrap();

      const attendanceArr = Array.isArray(res?.data?.attendance)
        ? res.data.attendance
        : [];
      setAttendanceRows(attendanceArr);
    } catch (error) {
      message.error(
        error?.data?.message ||
          error?.message ||
          "Failed to fetch staff/attendance",
      );
    } finally {
      setFetching(false);
    }
  };

  useEffect(() => {
    // Auto-fetch only when attendance is enabled and we have endpoints.
    if (
      !ektaIntegration ||
      !apiConnected ||
      !attendanceEnabled ||
      !attendanceEndpoint
    )
      return;
    if (!staffEnabled || !staffEndpoint) return;
    handleFetch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    ektaIntegration?._id,
    apiConnected,
    attendanceEnabled,
    attendanceEndpoint,
    staffEnabled,
    staffEndpoint,
    selectedMonth,
  ]);

  return (
    <div>
      <Space style={{ marginBottom: 24 }}>
        <Button
          icon={<ArrowLeftOutlined />}
          onClick={() => navigate("/settings/company")}
        >
          Back
        </Button>
        <Title level={2} style={{ margin: 0 }}>
          Attendance
        </Title>
      </Space>

      {!ektaIntegration ? (
        <Alert
          type="warning"
          message="Ekta integration not connected"
          description="Open Ekta HR Integration from Integrations and click Get API."
          showIcon
        />
      ) : (
        <>
          <Card style={{ marginBottom: 16 }}>
            <Space align="center" wrap>
              <Text>Attendance Module</Text>
              <Switch checked={attendanceEnabled} disabled />
              <Tag color={present ? "green" : "default"}>
                {present ? "Attendance Present" : "Attendance Not Present"}
              </Tag>
            </Space>
          </Card>

          {!apiConnected ? (
            <Alert
              type="warning"
              message="Ekta API not connected"
              description="Go to Ekta HR Integration and click Get API."
              showIcon
              action={
                <Button
                  type="primary"
                  size="small"
                  onClick={() => navigate("/settings/company")}
                >
                  Configure Ekta
                </Button>
              }
            />
          ) : !attendanceEnabled ? (
            <Alert
              type="info"
              message="Attendance sync is disabled"
              description="Enable Attendance in Ekta HR Integration first."
              showIcon
              action={
                <Button
                  type="primary"
                  size="small"
                  onClick={() => navigate("/settings/company")}
                >
                  Enable in Config
                </Button>
              }
            />
          ) : (
            <>
              <Card style={{ marginBottom: 16 }}>
                <Space direction="vertical" style={{ width: "100%" }}>
                  <Title level={4} style={{ margin: 0 }}>
                    Attendance Month View
                  </Title>

                  <Space wrap>
                    <Button
                      type="primary"
                      loading={fetching || isLoading || staffIsLoading}
                      onClick={() => handleFetch()}
                    >
                      Fetch Attendance
                    </Button>
                    <Text type="secondary">Month</Text>
                    <MonthPicker
                      value={selectedMonth}
                      onChange={(v) => setSelectedMonth(v || dayjs())}
                    />
                  </Space>

                  <Text type="secondary">
                    Endpoint: <code>{attendanceEndpoint}</code>
                  </Text>
                </Space>
              </Card>

              <Table
                rowKey="key"
                columns={columns}
                dataSource={gridData}
                loading={fetching || isLoading || staffIsLoading}
                pagination={false}
                scroll={{ x: "max-content", y: 500 }}
              />
            </>
          )}
        </>
      )}
    </div>
  );
};

export default EktaHrAttendancePage;
