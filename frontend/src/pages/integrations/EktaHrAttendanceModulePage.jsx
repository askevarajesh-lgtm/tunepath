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

const staffEmployeeCode = (staff) =>
  staff?.employeeId?.employeeId ||
  staff?.employeeId ||
  staff?.employeeCode ||
  staff?._id ||
  "";

const attendanceEmployeeCode = (record) => {
  const empId = record?.employeeId;
  if (!empId) return record?.employeeCode || "";
  if (typeof empId === "string") return empId;
  if (typeof empId === "object") return empId.employeeId || empId.code || "";
  return record?.employeeCode || "";
};

const dateKey = (value) => {
  if (!value) return null;
  const d = dayjs(value);
  return d.isValid() ? d.format("YYYY-MM-DD") : null;
};

const EktaHrAttendanceModulePage = () => {
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

  const staffConfig = ektaIntegration?.config?.staff || {};
  const staffEnabled = Boolean(staffConfig?.enabled);
  const staffEndpoint = staffConfig?.endpoint || "";

  const [selectedMonth, setSelectedMonth] = useState(() => dayjs());
  const [fetching, setFetching] = useState(false);

  const [staffRows, setStaffRows] = useState([]);
  const [attendanceRows, setAttendanceRows] = useState([]);

  const [modal, setModal] = useState({
    visible: false,
    employeeName: "",
    day: "",
    status: "",
    punchIn: null,
    punchOut: null,
  });

  const monthDayKeys = useMemo(() => {
    const start = selectedMonth.startOf("month");
    const daysInMonth = start.daysInMonth();
    return Array.from({ length: daysInMonth }, (_, i) =>
      start.add(i, "day").format("YYYY-MM-DD"),
    );
  }, [selectedMonth]);

  const attendanceRecordMap = useMemo(() => {
    const map = new Map(); // employeeCode -> Map(dayKey -> record)
    for (const rec of attendanceRows || []) {
      const code = attendanceEmployeeCode(rec);
      const dk = dateKey(rec?.date || rec?.punchIn || rec?.punch_in || rec?.inTime || rec?.logIn || rec?.createdAt);
      if (!code || !dk) continue;
      if (!map.has(code)) map.set(code, new Map());
      map.get(code).set(dk, rec);
    }
    return map;
  }, [attendanceRows]);

  const gridData = useMemo(() => {
    return (staffRows || []).map((s) => {
      const code = staffEmployeeCode(s);
      const row = {
        key: code || s?._id,
        employeeName: s?.name || "",
      };

      for (const dk of monthDayKeys) {
        row[dk] = dk; // placeholder; render decides P/A based on attendanceRecordMap
      }

      return row;
    });
  }, [staffRows, monthDayKeys]);

  const columns = useMemo(() => {
    return [
      {
        title: "Staff",
        dataIndex: "employeeName",
        key: "employeeName",
        fixed: "left",
        width: 220,
      },
      ...monthDayKeys.map((dk) => ({
        title: dayjs(dk).date(),
        dataIndex: dk,
        key: dk,
        width: 42,
        align: "center",
        render: (_, row) => {
          const code = row?.key;
          const rec = attendanceRecordMap.get(code)?.get(dk);
          const present = rec ? isPresentAttendanceStatus(rec?.status, rec) : false;
          const tagValue = present ? "P" : "A";
          return (
            <span
              style={{ cursor: "pointer" }}
              onClick={() => {
                if (!rec) {
                  setModal({
                    visible: true,
                    employeeName: row?.employeeName || "",
                    day: dk,
                    status: "Absent",
                    punchIn: null,
                    punchOut: null,
                  });
                  return;
                }
                const isP = isPresentAttendanceStatus(rec?.status, rec);
                setModal({
                  visible: true,
                  employeeName: row?.employeeName || "",
                  day: dk,
                  status: isP ? (rec?.status || "Present") : (rec?.status || "Absent"),
                  punchIn: rec?.punchIn || rec?.punch_in || rec?.logIn || rec?.inTime || null,
                  punchOut: rec?.punchOut || rec?.punch_out || rec?.logOut || rec?.outTime || null,
                });
              }}
            >
              <Tag color={present ? "green" : "default"}>{tagValue}</Tag>
            </span>
          );
        },
      })),
    ];
  }, [monthDayKeys, attendanceRecordMap]);

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
    if (!attendanceEnabled || !attendanceEndpoint) {
      message.warning(
        "Attendance is not enabled/configured in Ekta HR Integration.",
      );
      return;
    }

    setFetching(true);
    try {
      const staffRes = await syncEktaStaff({
        id: ektaIntegration._id,
        endpoint: staffEndpoint,
      }).unwrap();
      const staffArr = Array.isArray(staffRes?.data?.staff)
        ? staffRes.data.staff
        : [];
      setStaffRows(staffArr);

      const attendanceRes = await syncEktaAttendance({
        id: ektaIntegration._id,
        endpoint: attendanceEndpoint,
        fromDate,
        toDate,
      }).unwrap();
      const attendanceArr = Array.isArray(attendanceRes?.data?.attendance)
        ? attendanceRes.data.attendance
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
              <Tag color={attendanceConfig?.present ? "green" : "default"}>
                {attendanceConfig?.present
                  ? "Attendance Present"
                  : "Attendance Not Present"}
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
                      onClick={handleFetch}
                    >
                      Fetch Attendance
                    </Button>
                    <Text type="secondary">Month</Text>
                    <MonthPicker
                      value={selectedMonth}
                      onChange={(v) => setSelectedMonth(v || dayjs())}
                    />
                  </Space>
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

      <Modal
        open={modal.visible}
        title={`${modal.employeeName || "Staff"} - ${modal.day}`}
        footer={null}
        onCancel={() => setModal((m) => ({ ...m, visible: false }))}
      >
        {modal.status === "Absent" ? (
          <Text type="secondary">Absent</Text>
        ) : (
          <Space direction="vertical" style={{ width: "100%" }}>
            <Text>Status: {modal.status}</Text>
            <Text>Log In: {formatMaybeDateTime(modal.punchIn)}</Text>
            <Text>Log Out: {formatMaybeDateTime(modal.punchOut)}</Text>
          </Space>
        )}
      </Modal>
    </div>
  );
};

export default EktaHrAttendanceModulePage;
