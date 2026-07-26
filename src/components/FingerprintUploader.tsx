/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { 
  Upload, FileText, CheckCircle2, AlertTriangle, Play, ArrowRight, ArrowLeft, 
  RefreshCw, Layers, ShieldAlert, Check, X, HelpCircle, Info, Trash2, Calendar,
  Network, Cpu, Wifi, Smartphone, Plus, Settings, User, Eye, CheckSquare, Zap
} from 'lucide-react';
import { db } from '../supabaseClient';
import { Employee, ShiftSchedule, AttendanceLog } from '../types';
import { timeToMinutes, pairPunchesByWindows, addMinutesToTimeStr } from '../utils/calc';

const ARABIC_MONTHS = [
  { value: 1, label: 'يناير (01)' },
  { value: 2, label: 'فبراير (02)' },
  { value: 3, label: 'مارس (03)' },
  { value: 4, label: 'أبريل (04)' },
  { value: 5, label: 'مايو (05)' },
  { value: 6, label: 'يونيو (06)' },
  { value: 7, label: 'يوليو (07)' },
  { value: 8, label: 'أغسطس (08)' },
  { value: 9, label: 'سبتمبر (09)' },
  { value: 10, label: 'أكتوبر (10)' },
  { value: 11, label: 'نوفمبر (11)' },
  { value: 12, label: 'ديسمبر (12)' }
];

const getTodayStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

const getFirstDayOfMonthStr = () => {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${yyyy}-${mm}-01`;
};

const getLast7DaysStr = () => {
  const d = new Date();
  d.setDate(d.getDate() - 6);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

interface FingerprintUploaderProps {
  employees: Employee[];
  shifts: ShiftSchedule[];
  onUploadSuccess: () => void;
  isOpen: boolean;
  onClose: () => void;
}

interface ParsedPunch {
  rawEmpId: string;
  matchedEmployee: Employee | null;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  dateTimeObj: Date;
}

interface GroupedDailyPunch {
  employeeId: string;
  matchedEmployee: Employee | null;
  date: string;
  punches: string[]; // sorted times
  shift1_check_in: string | null;
  shift1_check_out: string | null;
  shift2_check_in: string | null;
  shift2_check_out: string | null;
  warning?: string;
  selected: boolean;
}

export default function FingerprintUploader({ 
  employees, 
  shifts, 
  onUploadSuccess, 
  isOpen, 
  onClose 
}: FingerprintUploaderProps) {
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [fileName, setFileName] = useState<string>('');
  const [rawText, setRawText] = useState<string>('');
  const [parsedPunches, setParsedPunches] = useState<ParsedPunch[]>([]);
  const [groupedLogs, setGroupedLogs] = useState<GroupedDailyPunch[]>([]);
  const [delimiter, setDelimiter] = useState<string>('auto');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [syncing, setSyncing] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedMonths, setSelectedMonths] = useState<number[] | 'all'>([new Date().getMonth() + 1]);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // --- ZKTECO ONLINE DIRECT SYNC STATE ---
  const [activeTab, setActiveTab] = useState<'file' | 'online'>('file');
  const [devices, setDevices] = useState<any[]>([]);
  const [zkRawLogs, setZkRawLogs] = useState<any[]>([]);
  const [deviceSN, setDeviceSN] = useState('');
  const [deviceName, setDeviceName] = useState('');
  const [loadingZk, setLoadingZk] = useState(false);
  const [submittingDevice, setSubmittingDevice] = useState(false);
  const [syncingOnlineLogs, setSyncingOnlineLogs] = useState(false);
  const [zkSection, setZkSection] = useState<'status' | 'logs' | 'guide'>('status');
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [shortUrl, setShortUrl] = useState<string>('');
  const [loadingShortUrl, setLoadingShortUrl] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<'bsma' | 'cloud' | null>(null);

  // --- DATE RANGE FOR CLOUD LOGS ---
  const [fromDate, setFromDate] = useState<string>(getFirstDayOfMonthStr());
  const [toDate, setToDate] = useState<string>(getTodayStr());
  const [fetchingCloudLogs, setFetchingCloudLogs] = useState<boolean>(false);

  const fetchShortUrl = async () => {
    setLoadingShortUrl(true);
    try {
      const res = await fetch('/api/short-url');
      const contentType = res.headers.get('content-type') || '';
      if (res.ok && contentType.includes('application/json')) {
        const data = await res.json();
        if (data && data.shortUrl) {
          let url = data.shortUrl;
          if (url.includes('localhost') || url.includes('127.0.0.1')) {
            url = 'https://basmah-tech.onrender.com/adms';
          }
          setShortUrl(url);
          return;
        }
      }
      setShortUrl('https://basmah-tech.onrender.com/adms');
    } catch (err) {
      console.error('Error fetching short URL:', err);
      setShortUrl('https://basmah-tech.onrender.com/adms');
    } finally {
      setLoadingShortUrl(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      (window as any).__IS_USER_EDITING__ = true;
    } else {
      (window as any).__IS_USER_EDITING__ = false;
    }
    return () => {
      (window as any).__IS_USER_EDITING__ = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && activeTab === 'online' && !shortUrl) {
      fetchShortUrl();
    }
  }, [isOpen, activeTab, shortUrl]);

  useEffect(() => {
    let timer: any;
    if (isOpen && activeTab === 'online') {
      timer = setInterval(() => {
        setCurrentTime(Date.now());
      }, 5000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [isOpen, activeTab]);

  const loadZkData = async (overrideFrom?: string, overrideTo?: string) => {
    setLoadingZk(true);
    try {
      const fDate = overrideFrom ?? fromDate;
      const tDate = overrideTo ?? toDate;
      // @ts-ignore
      const [devList, logList] = await Promise.all([
        db.getDevices(),
        db.getZkRawLogs({ fromDate: fDate, toDate: tDate })
      ]);
      setDevices(devList || []);
      setZkRawLogs(logList || []);
    } catch (err) {
      console.error('Error loading ZK data:', err);
    } finally {
      setLoadingZk(false);
    }
  };

  const fetchCloudLogs = async (overrideFrom?: string, overrideTo?: string) => {
    const fDate = overrideFrom ?? fromDate;
    const tDate = overrideTo ?? toDate;
    setFetchingCloudLogs(true);
    setError(null);
    setSuccess(null);
    try {
      // @ts-ignore
      const logList = await db.getZkRawLogs({ fromDate: fDate, toDate: tDate });
      setZkRawLogs(logList || []);
      setSuccess(`تم سحب ${logList?.length || 0} بصمة من السحابة للفترة من ${fDate} إلى ${tDate}`);
      setTimeout(() => setSuccess(null), 4000);
    } catch (err) {
      console.error('Error fetching cloud logs:', err);
      setError('حدث خطأ أثناء سحب البصمات من السحابة.');
    } finally {
      setFetchingCloudLogs(false);
    }
  };

  const handlePresetToday = () => {
    const today = getTodayStr();
    setFromDate(today);
    setToDate(today);
    fetchCloudLogs(today, today);
  };

  const handlePresetLast7Days = () => {
    const last7 = getLast7DaysStr();
    const today = getTodayStr();
    setFromDate(last7);
    setToDate(today);
    fetchCloudLogs(last7, today);
  };

  const handlePresetCurrentMonth = () => {
    const firstDay = getFirstDayOfMonthStr();
    const today = getTodayStr();
    setFromDate(firstDay);
    setToDate(today);
    fetchCloudLogs(firstDay, today);
  };

  // In-Memory Virtual DAT Processing for Online Device Logs
  const handleProcessOnlineLogsToSmartEngine = async () => {
    setFetchingCloudLogs(true);
    setError(null);
    setSuccess(null);
    try {
      const { datText, count, error: errMsg } = await db.getVirtualDat(fromDate, toDate);
      if (errMsg) {
        setError('حدث خطأ أثناء جلب البصمات أونلاين من السحابة.');
        return;
      }
      if (!datText || !datText.trim() || count === 0) {
        setError(`لا توجد حركات بصمة أونلاين مسجلة في السحابة للفترة المحددة من ${fromDate} إلى ${toDate}`);
        return;
      }

      setFileName(`Online_Device_${fromDate}_to_${toDate}.dat`);
      setRawText(datText);

      // Pass virtual DAT text directly to the smart processor
      handleParse(datText, 'auto', 'all');

      // Switch to file tab to display Step 2 (Smart Engine Review step)
      setActiveTab('file');

      setSuccess(`تم جلب وتحويل ${count} حركة بصمة من جهاز البصمة أونلاين بالذاكرة (In-Memory Virtual DAT) وتمريرها بنجاح للمعالج الذكي!`);
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error('Error processing virtual DAT:', err);
      setError('فشل تحويل ومعالجة البصمات أونلاين عبر المعالج الذكي.');
    } finally {
      setFetchingCloudLogs(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      if (activeTab === 'online') {
        loadZkData();
      } else {
        setError(null);
        setSuccess(null);
      }
    }
  }, [activeTab, isOpen]);

  const updateDelimiter = (newDelim: string) => {
    setDelimiter(newDelim);
    if (rawText) {
      handleParse(rawText, newDelim, selectedMonths, selectedYear);
    }
  };

  const updateMonthFilter = (clickedMonth: number | 'all') => {
    let nextMonths: number[] | 'all' = 'all';
    
    if (clickedMonth === 'all') {
      nextMonths = 'all';
    } else {
      if (selectedMonths === 'all') {
        nextMonths = [clickedMonth];
      } else {
        if (selectedMonths.includes(clickedMonth)) {
          const filtered = selectedMonths.filter(m => m !== clickedMonth);
          nextMonths = filtered.length === 0 ? 'all' : filtered;
        } else {
          nextMonths = [...selectedMonths, clickedMonth].sort((a, b) => a - b);
        }
      }
    }
    
    setSelectedMonths(nextMonths);
    if (rawText) {
      handleParse(rawText, delimiter, nextMonths, selectedYear);
    }
  };

  const updateYearFilter = (newYear: number) => {
    setSelectedYear(newYear);
    if (rawText) {
      handleParse(rawText, delimiter, selectedMonths, newYear);
    }
  };

  if (!isOpen) return null;

  // Helper to parse date string into standard YYYY-MM-DD
  const cleanDate = (dateStr: string): string | null => {
    const dStr = dateStr.trim();
    
    // YYYY-MM-DD or YYYY/MM/DD
    const ymdMatch = dStr.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymdMatch) {
      const y = ymdMatch[1];
      const m = ymdMatch[2].padStart(2, '0');
      const d = ymdMatch[3].padStart(2, '0');
      return `${y}-${m}-${d}`;
    }

    // DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = dStr.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const d = dmyMatch[1].padStart(2, '0');
      const m = dmyMatch[2].padStart(2, '0');
      const y = dmyMatch[3];
      return `${y}-${m}-${d}`;
    }

    // If it's a timestamp like "20260625" (rare, but sometimes present)
    if (/^\d{8}$/.test(dStr)) {
      return `${dStr.substring(0, 4)}-${dStr.substring(4, 6)}-${dStr.substring(6, 8)}`;
    }

    return null;
  };

  // Helper to standardise time to HH:MM
  const cleanTime = (timeStr: string): string | null => {
    const tStr = timeStr.trim();
    const match = tStr.match(/^(\d{1,2}):(\d{1,2})(:(\d{1,2}))?$/);
    if (match) {
      const h = match[1].padStart(2, '0');
      const m = match[2].padStart(2, '0');
      return `${h}:${m}`;
    }
    // Simple 4 digits like 0800
    if (/^\d{4}$/.test(tStr)) {
      return `${tStr.substring(0, 2)}:${tStr.substring(2, 4)}`;
    }
    return null;
  };

  // Run the parser logic
  const handleParse = (
    text: string, 
    currentDelimiter: string, 
    monthFilter: number[] | 'all' = selectedMonths, 
    yearFilter: number = selectedYear
  ) => {
    setError(null);
    if (!text.trim()) {
      setError('الملف المرفوع فارغ أو غير صالح.');
      return;
    }

    const lines = text.split(/\r?\n/);
    const tempPunches: ParsedPunch[] = [];

    lines.forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) return; // skip empty/comments

      // Detect Delimiter
      let parts: string[] = [];
      if (currentDelimiter === 'auto') {
        if (trimmed.includes('\t')) parts = trimmed.split('\t');
        else if (trimmed.includes(',')) parts = trimmed.split(',');
        else if (trimmed.includes(';')) parts = trimmed.split(';');
        else parts = trimmed.split(/\s+/); // default space-delimited
      } else if (currentDelimiter === 'tab') {
        parts = trimmed.split('\t');
      } else if (currentDelimiter === 'comma') {
        parts = trimmed.split(',');
      } else if (currentDelimiter === 'semicolon') {
        parts = trimmed.split(';');
      } else {
        parts = trimmed.split(/\s+/);
      }

      // Filter out empty parts
      parts = parts.map(p => p.trim()).filter(Boolean);
      if (parts.length < 2) return;

      let empIdCandidate = '';
      let dateFound: string | null = null;
      let timeFound: string | null = null;

      // Let's iterate through the tokens to find a Date and Time
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        
        const dateTry = cleanDate(part);
        if (dateTry) {
          dateFound = dateTry;
          if (i + 1 < parts.length) {
            const timeTry = cleanTime(parts[i + 1]);
            if (timeTry) {
              timeFound = timeTry;
            }
          }
          continue;
        }

        if (part.includes(' ') || part.includes('T')) {
          const subParts = part.replace('T', ' ').split(' ');
          if (subParts.length >= 2) {
            const dTry = cleanDate(subParts[0]);
            const tTry = cleanTime(subParts[1]);
            if (dTry && tTry) {
              dateFound = dTry;
              timeFound = tTry;
              continue;
            }
          }
        }

        if (!empIdCandidate && part.length > 0 && !cleanDate(part) && !cleanTime(part)) {
          if (i === 0 || parts.length <= 3 || part.length > 1) {
            empIdCandidate = part;
          }
        }
      }

      if (!empIdCandidate && parts.length > 0) {
        empIdCandidate = parts[0];
      }

      if (empIdCandidate && dateFound && timeFound) {
        const [year, month, day] = dateFound.split('-').map(Number);

        if (monthFilter !== 'all') {
          if (!monthFilter.includes(month) || year !== yearFilter) {
            return; // skip records not matching selected months/year
          }
        }

        const matchedEmp = employees.find(
          e => e.emp_id.trim().toLowerCase() === empIdCandidate.trim().toLowerCase()
        ) || null;

        const [hours, minutes] = timeFound.split(':').map(Number);
        const dateTimeObj = new Date(year, month - 1, day, hours, minutes, 0);

        tempPunches.push({
          rawEmpId: empIdCandidate,
          matchedEmployee: matchedEmp,
          date: dateFound,
          time: timeFound,
          dateTimeObj
        });
      }
    });

    if (tempPunches.length === 0) {
      setError(
        monthFilter === 'all' 
          ? 'فشل في العثور على سجلات بصمة متوافقة في الملف. يرجى التأكد من اختيار الفاصل الصحيح للأعمدة.'
          : `لا توجد حركات بصمة متوافقة للموظفين في الأشهر المحددة (${monthFilter.join(', ')}) وسنة ${yearFilter}. يرجى التأكد من محتوى الملف أو تغيير خيار تصفية الشهر.`
      );
      setParsedPunches([]);
      setGroupedLogs([]);
      return;
    }

    setParsedPunches(tempPunches);
    
    // Helper to add/subtract minutes from HH:MM
    const addMinutesToTimeStr = (timeStr: string, mins: number): string => {
      const total = (timeToMinutes(timeStr) + mins + 1440) % 1440;
      const h = Math.floor(total / 60);
      const m = total % 60;
      return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    };

    // 1. Group raw punches by employee ID
    const empPunchesMap: Record<string, ParsedPunch[]> = {};
    tempPunches.forEach((p) => {
      if (!empPunchesMap[p.rawEmpId]) empPunchesMap[p.rawEmpId] = [];
      empPunchesMap[p.rawEmpId].push(p);
    });

    const dailyLogs: GroupedDailyPunch[] = [];

    // 2. Process each employee using shift window evaluation
    Object.keys(empPunchesMap).forEach((rawEmpId) => {
      const pList = empPunchesMap[rawEmpId];
      const matchedEmp = pList[0].matchedEmployee;
      const schedule = matchedEmp
        ? (shifts.find((s) => s.id === matchedEmp.shift_schedule_id) || shifts[0])
        : shifts[0];

      // Collect all candidate dates (including previous calendar day for overnight checkout windows)
      const datesSet = new Set<string>();
      pList.forEach((p) => {
        datesSet.add(p.date);
        const pDateParts = p.date.split('-').map(Number);
        const pDateObj = new Date(pDateParts[0], pDateParts[1] - 1, pDateParts[2], 0, 0, 0, 0);
        const prevDateObj = new Date(pDateObj.getTime() - 86400000);
        const prevDateStr = `${prevDateObj.getFullYear()}-${String(prevDateObj.getMonth() + 1).padStart(2, '0')}-${String(prevDateObj.getDate()).padStart(2, '0')}`;
        datesSet.add(prevDateStr);
      });

      const candidateDates = Array.from(datesSet).sort();

      candidateDates.forEach((dateStr) => {
        if (!schedule) return;

        // Pair ALL punches of this employee relative to candidate dateStr
        const paired = pairPunchesByWindows(
          dateStr,
          schedule,
          pList.map((p) => ({
            time: p.time,
            date: p.date,
            dateTimeObj: p.dateTimeObj,
          }))
        );

        // Raw punches occurring on calendar date dateStr
        const rawPunchesOnCalendarDate = pList
          .filter((p) => p.date === dateStr)
          .map((p) => p.time);
        const uniqueTimes = Array.from(new Set(rawPunchesOnCalendarDate));

        const hasPairing =
          paired.shift1_check_in !== null ||
          paired.shift1_check_out !== null ||
          paired.shift2_check_in !== null ||
          paired.shift2_check_out !== null;

        if (hasPairing || rawPunchesOnCalendarDate.length > 0) {
          dailyLogs.push({
            employeeId: rawEmpId,
            matchedEmployee: matchedEmp,
            date: dateStr,
            punches: uniqueTimes,
            shift1_check_in: paired.shift1_check_in,
            shift1_check_out: paired.shift1_check_out,
            shift2_check_in: paired.shift2_check_in,
            shift2_check_out: paired.shift2_check_out,
            warning: !matchedEmp ? 'الرقم الوظيفي غير مسجل بالنظام' : undefined,
            selected: matchedEmp !== null,
          });
        }
      });
    });

    // Sort logs: newest date first, then employee ID
    dailyLogs.sort((a, b) => {
      const dateCompare = b.date.localeCompare(a.date);
      if (dateCompare !== 0) return dateCompare;
      return a.employeeId.localeCompare(b.employeeId);
    });

    setGroupedLogs(dailyLogs);
    setStep(2);
    setStep(2);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setError(null);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setRawText(text);
      handleParse(text, delimiter, selectedMonths, selectedYear);
    };
    reader.onerror = () => {
      setError('خطأ أثناء قراءة الملف.');
    };
    reader.readAsText(file);
  };

  const toggleSelectAll = () => {
    const allSelected = groupedLogs.every(log => !log.matchedEmployee || log.selected);
    setGroupedLogs(
      groupedLogs.map(log => ({
        ...log,
        selected: log.matchedEmployee ? !allSelected : false
      }))
    );
  };

  const toggleSelectRow = (index: number) => {
    setGroupedLogs(
      groupedLogs.map((log, i) => 
        i === index && log.matchedEmployee
          ? { ...log, selected: !log.selected }
          : log
      )
    );
  };

  const handleSyncToDatabase = async () => {
    const toSync = groupedLogs.filter(l => l.selected && l.matchedEmployee);
    if (toSync.length === 0) {
      setError('يرجى تحديد سجل واحد على الأقل معتمد للحفظ.');
      return;
    }

    setSyncing(true);
    setError(null);
    setSuccess(null);

    try {
      let successCount = 0;
      let failCount = 0;

      await Promise.all(
        toSync.map(async (item) => {
          if (!item.matchedEmployee) return;

          const logPayload: Omit<AttendanceLog, 'user_id' | 'id'> & { id?: string } = {
            employee_id: item.matchedEmployee.id,
            date: item.date,
            shift1_check_in: item.shift1_check_in,
            shift1_check_out: item.shift1_check_out,
            shift2_check_in: item.shift2_check_in,
            shift2_check_out: item.shift2_check_out,
            notes: 'تم استيراد بصمة الجهاز السحابي تلقائياً'
          };

          const { error: saveErr } = await db.saveAttendanceLog(logPayload);
          if (saveErr) {
            failCount++;
          } else {
            successCount++;
          }
        })
      );

      if (failCount === 0) {
        setSuccess(`تم بنجاح رفع ومطابقة ${successCount} سجل حضور في قاعدة البيانات ومزامنة تقارير الدوام!`);
        setStep(3);
        onUploadSuccess();
      } else {
        setError(`اكتمل الاستيراد مع بعض الأخطاء: تم حفظ ${successCount} وفشل ${failCount} سجل.`);
      }
    } catch (err: any) {
      setError('فشل غير متوقع في معالجة المزامنة.');
    } finally {
      setSyncing(false);
    }
  };

  const handleReset = () => {
    setStep(1);
    setFileName('');
    setRawText('');
    setParsedPunches([]);
    setGroupedLogs([]);
    setError(null);
    setSuccess(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceSN.trim() || !deviceName.trim()) {
      setError('الرجاء إدخال اسم الجهاز والرقم التسلسلي بشكل صحيح.');
      return;
    }
    setSubmittingDevice(true);
    setError(null);
    setSuccess(null);
    try {
      // @ts-ignore
      const result = await db.registerDevice(deviceSN, deviceName);
      if (result.success) {
        setSuccess('تم تسجيل جهاز البصمة بنجاح في السحابة الخاصة بك!');
        setDeviceSN('');
        setDeviceName('');
        await loadZkData();
        
        // Scroll down to the bottom of the device area so the user immediately sees the newly added device
        setTimeout(() => {
          const area = document.getElementById('online-device-scroll-area');
          if (area) {
            area.scrollTo({ top: area.scrollHeight, behavior: 'smooth' });
          }
        }, 150);
      } else {
        setError(result.error?.message || 'فشل تسجيل الجهاز.');
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال بالخادم.');
    } finally {
      setSubmittingDevice(false);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (!window.confirm('هل أنت متأكد من إلغاء ربط وإزالة هذا الجهاز؟')) return;
    setError(null);
    setSuccess(null);
    try {
      // @ts-ignore
      const result = await db.deleteDevice(id);
      if (result.success) {
        setSuccess('تم إزالة وتفكيك ربط جهاز البصمة بنجاح.');
        await loadZkData();
      } else {
        setError('تعذر إزالة الجهاز.');
      }
    } catch (err) {
      setError('تعذر الاتصال بالخادم.');
    }
  };

  const handleSyncPushedLogs = async () => {
    if (zkRawLogs.length === 0) return;
    setSyncingOnlineLogs(true);
    setError(null);
    setSuccess(null);
    try {
      const logIds = zkRawLogs.map(l => l.id);
      // @ts-ignore
      const result = await db.syncZkLogs(logIds);
      if (result.success) {
        setSuccess(`تم بنجاح سحب ومزامنة عدد ${result.count} يومية حضور وانصراف مجمعة للموظفين وتطبيق القواعد عليها تلقائياً!`);
        await loadZkData();
        onUploadSuccess();
      } else {
        setError(result.error?.message || 'فشل مزامنة البصمات السحابية.');
      }
    } catch (err: any) {
      setError(err.message || 'خطأ في الاتصال بالخادم.');
    } finally {
      setSyncingOnlineLogs(false);
    }
  };

  return (
    <div id="fingerprint-uploader-modal" className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-4xl w-full p-6 text-right flex flex-col max-h-[90vh] shadow-2xl">
        
        {/* Header */}
        <div className="flex justify-between items-center border-b border-slate-800 pb-3 flex-shrink-0">
          <h3 className="text-sm font-bold text-slate-100 flex items-center gap-2">
            <Network className="w-5 h-5 text-emerald-400" />
            <span>إدارة وسحب بصمات الموظفين (بصمة تك - Basma Tech)</span>
          </h3>
          <button
            onClick={onClose}
            className="p-1 hover:bg-slate-800 text-slate-500 hover:text-slate-300 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-slate-800 mt-2 flex-shrink-0 bg-slate-950/20 rounded-t-xl overflow-hidden">
          <button
            onClick={() => setActiveTab('file')}
            className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'file'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-950/10'
            }`}
          >
            <Upload className="w-4 h-4" />
            <span>رفع ملف البصمات التقليدي (.DAT, .TXT, .CSV)</span>
          </button>
          <button
            onClick={() => setActiveTab('online')}
            className={`flex-1 py-3 text-xs font-bold transition flex items-center justify-center gap-2 border-b-2 cursor-pointer ${
              activeTab === 'online'
                ? 'border-emerald-500 text-emerald-400 bg-slate-900/40'
                : 'border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-950/10'
            }`}
          >
            <Wifi className="w-4 h-4 text-emerald-400 animate-pulse" />
            <span>ربط جهاز البصمة مباشر أونلاين (سحابي 🛜)</span>
          </button>
        </div>

        {/* Error and Success Notifications */}
        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs rounded-xl flex items-center gap-2 justify-start mt-3 flex-shrink-0">
            <AlertTriangle className="w-4 h-4 text-rose-500 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {success && (
          <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs rounded-xl flex items-center gap-2 justify-start mt-3 flex-shrink-0">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>{success}</span>
          </div>
        )}

        {/* ==========================================
            === TAB 1: FILE-BASED TRADITIONAL UPLOAD ===
            ========================================== */}
        {activeTab === 'file' && (
          <div className="flex-1 flex flex-col min-h-0">
            {/* Step Wizard Indicator */}
            <div className="flex justify-center items-center gap-4 py-4 border-b border-slate-850/60 bg-slate-950/20 px-2 rounded-xl mt-3 flex-shrink-0">
              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step >= 1 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  1
                </div>
                <span className={`text-[10px] font-bold ${step >= 1 ? 'text-slate-200' : 'text-slate-500'}`}>
                  رفع الملف واختيار الفاصل
                </span>
              </div>

              <div className="w-8 h-[1px] bg-slate-800" />

              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step >= 2 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  2
                </div>
                <span className={`text-[10px] font-bold ${step >= 2 ? 'text-slate-200' : 'text-slate-500'}`}>
                  المطابقة ومراجعة البصمات اليومية
                </span>
              </div>

              <div className="w-8 h-[1px] bg-slate-800" />

              <div className="flex items-center gap-1.5">
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  step === 3 ? 'bg-emerald-500 text-slate-950' : 'bg-slate-800 text-slate-400'
                }`}>
                  3
                </div>
                <span className={`text-[10px] font-bold ${step === 3 ? 'text-slate-200' : 'text-slate-500'}`}>
                  المزامنة النهائية وحفظ السجلات
                </span>
              </div>
            </div>

            {/* Content Body (Scrollable) */}
            <div className="flex-1 overflow-y-auto py-5 space-y-4">
              
              {/* STEP 1: UPLOAD AND CONFIGURE */}
              {step === 1 && (
                <div className="space-y-6">
                  {/* Instructions and tip banner */}
                  <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl space-y-2 text-xs leading-relaxed text-slate-300">
                    <h4 className="font-bold text-emerald-400 flex items-center gap-1">
                      <Info className="w-4 h-4" />
                      <span>طريقة عمل مستورد البصمات الذكي:</span>
                    </h4>
                    <p>
                      يقوم المعالج بقراءة ملفات الحركات المستخرجة من أجهزة البصمة البيومترية (مثل ZKTeco وغيرها). 
                      سيقوم الذكاء الاصطناعي في المعالج بفلترة الملف وترتيب الحركات زمنياً لكل موظف على حدة في نفس اليوم، 
                      ثم تحويلها إلى بصمتي حضور وانصراف (أو شفتين كاملين) تلقائياً بناءً على إعدادات وردية الموظف في النظام.
                    </p>
                  </div>

                  {/* Monthly Filter Config */}
                  <div className="bg-slate-950/45 border border-slate-850/60 p-4 rounded-xl space-y-4">
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                      <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-emerald-400" />
                        <span>تحديد شهر أو عدة شهور وسنة رفع ملف البصمة (يمكنك اختيار عدة شهور معاً):</span>
                      </span>
                      
                      {/* Year selector */}
                      <div className="flex items-center gap-1 bg-slate-900 border border-slate-800 rounded-lg p-0.5">
                        {[2025, 2026, 2027].map((yr) => (
                          <button
                            key={yr}
                            onClick={() => updateYearFilter(yr)}
                            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
                              selectedYear === yr
                                ? 'bg-emerald-500 text-slate-950 shadow-sm'
                                : 'text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {yr}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* 12 Months Grid */}
                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                      {ARABIC_MONTHS.map((m) => (
                        <button
                          key={m.value}
                          onClick={() => updateMonthFilter(m.value)}
                          className={`px-3 py-2 text-xs font-semibold rounded-lg border transition cursor-pointer text-center ${
                            selectedMonths !== 'all' && selectedMonths.includes(m.value)
                              ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold'
                              : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                          }`}
                        >
                          {m.label}
                        </button>
                      ))}
                      <button
                        onClick={() => updateMonthFilter('all')}
                        className={`px-3 py-2 text-xs font-bold rounded-lg border transition cursor-pointer text-center ${
                          selectedMonths === 'all'
                            ? 'bg-emerald-500 border-emerald-400 text-slate-950 font-bold'
                            : 'bg-slate-950 border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-800'
                        }`}
                      >
                        كل الأشهر (كامل الملف)
                      </button>
                    </div>

                    <p className="text-[10px] text-slate-400 text-right leading-relaxed font-sans">
                      💡 <strong className="text-slate-300">طريقة التحديد المتعدد:</strong> يمكنك النقر على أكثر من شهر لاختيار شهور متعددة معاً (مثل: يناير وفبراير ومارس)، أو اختر "كل الأشهر" لقراءة الملف بالكامل دون قيود.
                    </p>
                  </div>

                  {/* Drag and Drop Zone */}
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className="border-2 border-dashed border-slate-800 hover:border-emerald-500/50 bg-slate-950/20 hover:bg-slate-950/40 rounded-2xl py-12 px-6 flex flex-col items-center justify-center gap-3 cursor-pointer transition"
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      onChange={handleFileChange}
                      accept=".txt,.csv,.dat"
                      className="hidden" 
                    />
                    <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Upload className="w-6 h-6 animate-pulse" />
                    </div>
                    <div className="text-center space-y-1">
                      <p className="text-xs font-bold text-slate-200">
                        {fileName ? `الملف المحدد: ${fileName}` : 'اضغط هنا لتحديد واختيار ملف البصمة من جهازك'}
                      </p>
                      <p className="text-[10px] text-slate-500">
                        يدعم صيغ الملفات .TXT, .DAT, .CSV المصدرة من أجهزة ZK الصينية وغيرها
                      </p>
                    </div>
                  </div>

                  {/* Advanced Delimiter Picker */}
                  {rawText && (
                    <div className="bg-slate-950/40 border border-slate-850/60 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                      <div className="space-y-0.5">
                        <h5 className="text-[11px] font-bold text-slate-300">طريقة فصل الأعمدة في الملف:</h5>
                        <p className="text-[10px] text-slate-500">يقوم النظام بالمطابقة التلقائية، ولكن يمكنك تحديد فاصل الأعمدة يدوياً</p>
                      </div>
                      
                      <div className="flex gap-1.5">
                        {[
                          { value: 'auto', label: 'كشف تلقائي' },
                          { value: 'tab', label: 'Tab (جدولة)' },
                          { value: 'comma', label: 'Comma (فارزة ,)' },
                          { value: 'space', label: 'Space (مسافة)' },
                          { value: 'semicolon', label: 'Semicolon (;)' },
                        ].map((delim) => (
                          <button
                            key={delim.value}
                            onClick={() => updateDelimiter(delim.value)}
                            className={`px-3 py-1.5 text-[10px] font-bold rounded-lg border transition cursor-pointer ${
                              delimiter === delim.value
                                ? 'bg-emerald-500 border-emerald-400 text-slate-950'
                                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                            }`}
                          >
                            {delim.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Statistics metrics of parsed logs */}
                  {parsedPunches.length > 0 && (
                    <div className="grid grid-cols-3 gap-3">
                      <div className="bg-slate-950/45 p-3 rounded-xl border border-slate-850 text-right space-y-1">
                        <span className="text-[10px] text-slate-500 font-semibold block">إجمالي الحركات في الملف</span>
                        <span className="text-base font-black text-slate-200">{parsedPunches.length} حركة</span>
                      </div>
                      <div className="bg-slate-950/45 p-3 rounded-xl border border-slate-850 text-right space-y-1">
                        <span className="text-[10px] text-slate-500 font-semibold block">أيام الحضور المقروءة</span>
                        <span className="text-base font-black text-emerald-400">{groupedLogs.length} يوم عمل</span>
                      </div>
                      <div className="bg-slate-950/45 p-3 rounded-xl border border-slate-850 text-right space-y-1">
                        <span className="text-[10px] text-slate-500 font-semibold block">الأخطاء / حركات غير مطابقة</span>
                        <span className={`text-base font-black ${
                          groupedLogs.filter(l => l.warning).length > 0 ? 'text-rose-400' : 'text-slate-400'
                        }`}>
                          {groupedLogs.filter(l => l.warning).length} حركة
                        </span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* STEP 2: REVIEW PARSED LOGS */}
              {step === 2 && (
                <div className="space-y-4">
                  <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex justify-between items-center text-xs text-slate-300">
                    <div className="space-y-1">
                      <span className="font-bold text-slate-200 block">خطوة المراجعة والمطابقة البيومترية الذكية:</span>
                      <p className="text-[11px] text-slate-400 leading-relaxed">
                        يرجى تحديد السجلات التي ترغب بمزامنتها وترحيلها إلى قاعدة بيانات الحضور والانصراف السحابية. تم فرز حركات كل موظف وترتيبها زمنياً.
                      </p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0">
                      <button
                        onClick={toggleSelectAll}
                        className="px-2.5 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-300 font-bold rounded text-[10px] cursor-pointer"
                      >
                        تحديد الكل / إلغاء
                      </button>
                    </div>
                  </div>

                  <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20 max-h-[400px] overflow-y-auto">
                    <table className="w-full text-right text-xs">
                      <thead className="bg-slate-950 text-slate-400 sticky top-0 z-10">
                        <tr className="border-b border-slate-800">
                          <th className="p-3 w-10">اختر</th>
                          <th className="p-3">الموظف</th>
                          <th className="p-3">التاريخ</th>
                          <th className="p-3 text-center text-emerald-400 font-bold">وقت الدخول</th>
                          <th className="p-3 text-center text-amber-400 font-bold">وقت الخروج</th>
                          <th className="p-3 text-center text-emerald-400 font-bold">دخول (شفت 2)</th>
                          <th className="p-3 text-center text-amber-400 font-bold">خروج (شفت 2)</th>
                          <th className="p-3">الحركات الخام المقروءة</th>
                          <th className="p-3 text-right">الحالة</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-850">
                        {groupedLogs.map((log, idx) => {
                          return (
                            <tr key={`${log.employeeId}_${log.date}_${idx}`} className="hover:bg-slate-900/30 transition">
                              <td className="p-3 text-center">
                                <input
                                  type="checkbox"
                                  checked={log.selected}
                                  onChange={() => toggleSelectRow(idx)}
                                  className="w-4 h-4 accent-emerald-500 cursor-pointer"
                                />
                              </td>
                              <td className="p-3">
                                <div className="flex items-center gap-2">
                                  <div className="w-8 h-8 rounded-full bg-slate-850 flex items-center justify-center text-[10px] font-bold text-slate-400">
                                    {log.matchedEmployee?.name.substring(0, 1) || '?'}
                                  </div>
                                  <div>
                                    <span className="font-bold text-slate-200 block">{log.matchedEmployee?.name || 'موظف غير معروف'}</span>
                                    <span className="text-[10px] text-slate-500 block">ID: {log.employeeId}</span>
                                  </div>
                                </div>
                              </td>
                              <td className="p-3 font-mono text-slate-300">{log.date}</td>
                              <td className="p-3 text-center font-mono text-[11px] font-bold text-emerald-400">
                                {log.shift1_check_in || '—'}
                              </td>
                              <td className="p-3 text-center font-mono text-[11px] font-bold text-amber-400">
                                {log.shift1_check_out || '—'}
                              </td>
                              <td className="p-3 text-center font-mono text-[11px] font-bold text-emerald-400">
                                {log.matchedEmployee?.is_dual_shift ? (log.shift2_check_in || '—') : '—'}
                              </td>
                              <td className="p-3 text-center font-mono text-[11px] font-bold text-amber-400">
                                {log.matchedEmployee?.is_dual_shift ? (log.shift2_check_out || '—') : '—'}
                              </td>
                              <td className="p-3 font-mono text-[10px] text-slate-400 max-w-[120px] truncate">
                                {log.punches.join(', ')}
                              </td>
                              <td className="p-3 text-right">
                                {log.warning ? (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                                    <AlertTriangle className="w-3 h-3" />
                                    <span>{log.warning}</span>
                                  </span>
                                ) : (
                                  <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                    <Check className="w-3 h-3" />
                                    <span>تمت المطابقة بنجاح</span>
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* STEP 3: SUCCESS & SYNC COMPLETE */}
              {step === 3 && (
                <div className="py-8 text-center space-y-6">
                  <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                    <CheckCircle2 className="w-10 h-10" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-base font-bold text-slate-100">تم ترحيل ومزامنة الحضور بنجاح!</h4>
                    <p className="text-xs text-slate-400 max-w-md mx-auto leading-relaxed">
                      تم الانتهاء من ترحيل بيانات الحركات الخاصة بجهاز البصمة وتطبيق جميع لوائح التأخير والوقت الإضافي والشيفت المزدوج عليها في الوقت الفعلي. يمكنك الآن مراجعة اليوميات أو توليد التقارير التراكمية للشركة.
                    </p>
                  </div>

                  <div className="pt-4">
                    <button
                      onClick={handleReset}
                      className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-lg text-xs cursor-pointer transition shadow shadow-emerald-500/10"
                    >
                      استيراد ملف بصمة آخر
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Footer controls (Fixed size) */}
            <div className="border-t border-slate-800 pt-4 flex justify-between items-center flex-shrink-0 mt-auto font-sans">
              <div>
                {step === 2 && (
                  <button
                    onClick={() => setStep(1)}
                    className="px-4 py-2 bg-slate-950 border border-slate-800 hover:border-slate-700 text-slate-300 hover:text-slate-100 rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
                  >
                    <ArrowRight className="w-4 h-4" />
                    <span>العودة لرفع ملف آخر</span>
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
                >
                  إغلاق المعالج
                </button>

                {step === 1 && parsedPunches.length > 0 && (
                  <button
                    onClick={() => setStep(2)}
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold rounded-lg text-xs transition flex items-center gap-1 cursor-pointer font-sans"
                  >
                    <span>الخطوة التالية (مراجعة المطابقة)</span>
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                )}

                {step === 2 && (
                  <button
                    onClick={handleSyncToDatabase}
                    disabled={syncing}
                    className="px-6 py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-extrabold rounded-lg text-xs transition flex items-center gap-2 cursor-pointer shadow shadow-emerald-500/10 font-sans"
                  >
                    {syncing ? (
                      <>
                        <RefreshCw className="w-4 h-4 animate-spin" />
                        <span>جاري حفظ وترحيل السجلات...</span>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4" />
                        <span>ترحيل السجلات ومطابقتها المباشرة</span>
                      </>
                    )}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ==========================================
            === TAB 2: ZKTECO DIRECT ONLINE SYNC ====
            ========================================== */}
        {activeTab === 'online' && (
          <div className="flex-1 flex flex-col min-h-0 text-right">
            {/* Online Sync Inner Tab Selector */}
            <div className="flex gap-2 py-3 border-b border-slate-850/60 flex-shrink-0">
              <button
                type="button"
                onClick={() => setZkSection('status')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  zkSection === 'status'
                    ? 'bg-emerald-500 text-slate-950 font-extrabold'
                    : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Cpu className="w-3.5 h-3.5" />
                <span>حالة الاتصال والأجهزة ({devices.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setZkSection('logs')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  zkSection === 'logs'
                    ? 'bg-emerald-500 text-slate-950 font-extrabold'
                    : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>طابور البصمات الواردة ({zkRawLogs.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setZkSection('guide')}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer ${
                  zkSection === 'guide'
                    ? 'bg-emerald-500 text-slate-950 font-extrabold'
                    : 'bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200'
                }`}
              >
                <Settings className="w-3.5 h-3.5" />
                <span>دليل تفعيل جهازك أونلاين 🌐</span>
              </button>
            </div>

            {/* Inner Content Area */}
            <div id="online-device-scroll-area" className="flex-1 overflow-y-auto py-4 space-y-4">
              {loadingZk && (
                <div className="py-12 text-center space-y-2">
                  <RefreshCw className="w-8 h-8 text-emerald-400 animate-spin mx-auto" />
                  <p className="text-xs text-slate-400">جاري الاتصال بالسحابة وسحب حالة أجهزة البصمة...</p>
                </div>
              )}

              {!loadingZk && (
                <>
                  {/* SECTION 1: STATUS AND REGISTER DEVICE */}
                  {zkSection === 'status' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-right">
                      {/* Register form */}
                      <div className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl space-y-4 text-right md:col-span-1">
                        <div className="space-y-1">
                          <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 justify-end">
                            <Plus className="w-4 h-4 text-emerald-400" />
                            <span>ربط وتسجيل جهاز بصمة جديد</span>
                          </h4>
                          <p className="text-[10px] text-slate-500 leading-relaxed font-sans text-right">
                            أدخل الرقم التسلسلي لجهازك (ZKTeco MP20) ليتم التعرف على بصماته ومزامنتها تلقائياً.
                          </p>
                        </div>

                        <form onSubmit={handleRegisterDevice} className="space-y-3">
                          <div className="space-y-1 text-right">
                            <label className="text-[10px] font-bold text-slate-400 block">اسم تصنيفي للجهاز:</label>
                            <input
                              type="text"
                              value={deviceName}
                              onChange={(e) => setDeviceName(e.target.value)}
                              placeholder="مثال: جهاز الفرع الرئيسي"
                              className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-lg p-2 text-xs text-slate-200 outline-none transition text-right font-sans"
                            />
                          </div>

                          <div className="space-y-1 text-right">
                            <label className="text-[10px] font-bold text-slate-400 block font-sans">الرقم التسلسلي للجهاز (Serial Number):</label>
                            <input
                              type="text"
                              value={deviceSN}
                              onChange={(e) => setDeviceSN(e.target.value)}
                              placeholder="مثال: MP202611223344"
                              className="w-full bg-slate-900 border border-slate-800 hover:border-slate-700 focus:border-emerald-500 rounded-lg p-2 text-xs font-mono text-slate-200 outline-none transition text-center"
                            />
                          </div>

                          <button
                            type="submit"
                            disabled={submittingDevice}
                            className="w-full py-2 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-bold rounded-lg text-xs transition cursor-pointer flex items-center justify-center gap-1.5 font-sans"
                          >
                            {submittingDevice ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Check className="w-3.5 h-3.5" />
                            )}
                            <span>تسجيل وتأمين ربط الجهاز</span>
                          </button>
                        </form>
                      </div>

                      {/* Devices list */}
                      <div className="md:col-span-2 space-y-3 text-right">
                        <div className="flex justify-between items-center">
                          <h4 className="text-xs font-bold text-slate-300">الأجهزة المرتبطة حالياً بالسحابة ({devices.length})</h4>
                          <button
                            onClick={loadZkData}
                            className="p-1.5 bg-slate-950 border border-slate-850 text-slate-400 hover:text-slate-200 hover:border-slate-700 rounded-lg transition"
                          >
                            <RefreshCw className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        {devices.length === 0 ? (
                          <div className="py-12 border border-dashed border-slate-800 rounded-xl text-center space-y-2 bg-slate-950/10">
                            <Wifi className="w-8 h-8 text-slate-600 mx-auto" />
                            <p className="text-xs text-slate-400 font-sans">لا يوجد أجهزة بصمة مسجلة حالياً.</p>
                            <p className="text-[10px] text-slate-500 max-w-sm mx-auto font-sans">
                              قم بتعبئة النموذج الجانبي لتسجيل جهاز ZKTeco MP20 الخاص بك والبدء بالسحب الفوري للبصمات.
                            </p>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-right">
                             {devices.map((dev) => {
                               const lastPingTime = (dev.last_seen || dev.last_ping) ? new Date(dev.last_seen || dev.last_ping).getTime() : 0;
                               const diffInSeconds = lastPingTime ? Math.max(0, Math.floor((currentTime - lastPingTime) / 1000)) : 999999;
                               const isOnline = diffInSeconds <= 60;

                               const formatLastPing = (pingStr: string | null) => {
                                 if (!pingStr) return 'لا يوجد اتصال سابق';
                                 const d = new Date(pingStr);
                                 if (isNaN(d.getTime())) return 'غير معروف';
                                 const now = new Date(currentTime);
                                 const isToday = d.getDate() === now.getDate() &&
                                                 d.getMonth() === now.getMonth() &&
                                                 d.getFullYear() === now.getFullYear();
                                 if (isToday) {
                                   return `اليوم الساعة ${d.toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
                                 }
                                 return d.toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'medium' });
                               };

                               return (
                                 <div key={dev.id} className="bg-slate-950/40 border border-slate-850 p-4 rounded-xl flex flex-col justify-between space-y-4">
                                   <div className="flex justify-between items-start">
                                     <div className="flex items-center gap-2">
                                       <span className="relative flex h-2.5 w-2.5">
                                         {isOnline && (
                                           <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                         )}
                                         <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isOnline ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                                       </span>
                                       <div className="text-right">
                                         <span className="font-bold text-xs text-slate-200 block">{dev.name}</span>
                                         <span className="text-[10px] font-mono text-slate-400 block">{dev.serial_number}</span>
                                       </div>
                                     </div>
                                     <button
                                       onClick={() => handleDeleteDevice(dev.id)}
                                       className="p-1.5 hover:bg-slate-900 text-rose-400 rounded-lg transition"
                                       title="إلغاء ربط الجهاز"
                                     >
                                       <Trash2 className="w-3.5 h-3.5" />
                                     </button>
                                   </div>

                                   <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-900 text-right">
                                     <div>
                                       <span className="text-[9px] text-slate-500 block">البصمات المسحوبة</span>
                                       <span className="text-[11px] font-bold text-slate-300 block font-mono">{dev.total_pushed_logs || 0} حركة</span>
                                     </div>
                                     <div>
                                       <span className="text-[9px] text-slate-500 block">بصمات بانتظار الترحيل</span>
                                       <span className="text-[11px] font-bold text-amber-400 block font-mono">{dev.pending_logs || 0} حركة</span>
                                     </div>
                                   </div>

                                   <div className="text-[9px] text-slate-400 pt-1 flex justify-between items-center font-mono">
                                     <span>آخر اتصال: {formatLastPing(dev.last_seen || dev.last_ping)}</span>
                                     {isOnline ? (
                                       <span className="bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded border border-emerald-500/20 text-[8px] font-sans font-bold">متصل سحابياً</span>
                                     ) : (
                                       <span className="bg-rose-500/10 text-rose-400 px-1.5 py-0.5 rounded border border-rose-500/20 text-[8px] font-sans font-bold">غير متصل (Offline)</span>
                                     )}
                                   </div>
                                 </div>
                               );
                             })}
                           </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* SECTION 2: RAW LOGS SYNC QUEUE */}
                  {zkSection === 'logs' && (
                    <div className="space-y-4 text-right">
                      {/* DATE RANGE & CLOUD FETCH CONTROLS */}
                      <div className="bg-slate-900/90 border border-slate-800 p-4 rounded-xl space-y-3 text-right shadow-sm">
                        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-100">
                            <Calendar className="w-4 h-4 text-emerald-400" />
                            <span>تحديد نطاق التاريخ لسحب البصمات من السحابة</span>
                          </div>
                          {/* Quick Presets */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-slate-400 font-sans ml-1">خيارات سريعة:</span>
                            <button
                              type="button"
                              onClick={handlePresetToday}
                              className="px-2.5 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer font-sans"
                            >
                              اليوم
                            </button>
                            <button
                              type="button"
                              onClick={handlePresetLast7Days}
                              className="px-2.5 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer font-sans"
                            >
                              آخر 7 أيام
                            </button>
                            <button
                              type="button"
                              onClick={handlePresetCurrentMonth}
                              className="px-2.5 py-1 text-[10px] font-bold bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-lg border border-slate-700 transition cursor-pointer font-sans"
                            >
                              الشهر الحالي
                            </button>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end pt-1">
                          {/* From Date */}
                          <div className="space-y-1 text-right">
                            <label className="text-[10px] text-slate-400 block font-sans">من تاريخ (From Date):</label>
                            <input
                              type="date"
                              value={fromDate}
                              onChange={(e) => setFromDate(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                            />
                          </div>

                          {/* To Date */}
                          <div className="space-y-1 text-right">
                            <label className="text-[10px] text-slate-400 block font-sans">إلى تاريخ (To Date):</label>
                            <input
                              type="date"
                              value={toDate}
                              onChange={(e) => setToDate(e.target.value)}
                              className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2 text-xs text-slate-200 font-mono focus:border-emerald-500 focus:outline-none"
                            />
                          </div>

                          {/* Primary: In-Memory Virtual DAT Processing Button */}
                          <div className="sm:col-span-1">
                            <button
                              type="button"
                              onClick={handleProcessOnlineLogsToSmartEngine}
                              disabled={fetchingCloudLogs || loadingZk}
                              className="w-full py-2 px-3 bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 disabled:from-slate-800 disabled:to-slate-800 text-slate-950 disabled:text-slate-500 font-black rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer shadow-lg shadow-emerald-500/20 font-sans"
                              title="يقوم بجلب الحركات وتحويلها في الذاكرة لتمريرها للمعالج الذكي لحساب الشفتات مباشرة"
                            >
                              {fetchingCloudLogs ? (
                                <>
                                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                                  <span>جاري التحويل بالذاكرة...</span>
                                </>
                              ) : (
                                <>
                                  <Zap className="w-3.5 h-3.5 fill-slate-950" />
                                  <span>سحب ومعالجة بالذاكرة (DAT)</span>
                                </>
                              )}
                            </button>
                          </div>

                          {/* Secondary: Fetch Cloud Logs List */}
                          <div>
                            <button
                              type="button"
                              onClick={() => fetchCloudLogs()}
                              disabled={fetchingCloudLogs || loadingZk}
                              className="w-full py-2 px-3 bg-slate-800 hover:bg-slate-700 disabled:bg-slate-900 text-slate-200 disabled:text-slate-600 font-bold rounded-lg text-xs transition flex items-center justify-center gap-1.5 cursor-pointer border border-slate-700 font-sans"
                            >
                              <RefreshCw className="w-3.5 h-3.5 text-slate-400" />
                              <span>تحديث القائمة</span>
                            </button>
                          </div>
                        </div>
                      </div>

                      <div className="bg-slate-950/60 border border-slate-850 p-4 rounded-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <div className="space-y-1 text-right">
                          <h4 className="text-xs font-bold text-slate-100 flex items-center gap-1.5 justify-end">
                            <Layers className="w-4 h-4 text-emerald-400" />
                            <span>البصمات السحابية الواردة بانتظار المزامنة والترحيل لجدول الدوام</span>
                          </h4>
                          <p className="text-[11px] text-slate-400 font-sans text-right">
                            هذه البصمات مرسلة تلقائياً من جهاز البصمة أونلاين عبر بروتوكول ADMS. اضغط على الزر لسحبها وترحيلها لملفات الحضور والرواتب فورياً.
                          </p>
                        </div>

                        <button
                          onClick={handleSyncPushedLogs}
                          disabled={zkRawLogs.length === 0 || syncingOnlineLogs}
                          className="px-5 py-2.5 bg-emerald-500 hover:bg-emerald-400 disabled:bg-slate-800 text-slate-950 disabled:text-slate-500 font-extrabold rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow shadow-emerald-500/10 font-sans"
                        >
                          {syncingOnlineLogs ? (
                            <>
                              <RefreshCw className="w-4 h-4 animate-spin" />
                              <span>جاري ترحيل البصمات...</span>
                            </>
                          ) : (
                            <>
                              <Wifi className="w-4 h-4 animate-pulse" />
                              <span>ترحيل البصمات لجدول الحضور ({zkRawLogs.length})</span>
                            </>
                          )}
                        </button>
                      </div>

                      {zkRawLogs.length === 0 ? (
                        <div className="py-16 text-center space-y-2 border border-dashed border-slate-800 rounded-xl bg-slate-950/10">
                          <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto" />
                          <p className="text-xs text-slate-200 font-bold font-sans">لا يوجد بصمات معلقة في الطابور حالياً!</p>
                          <p className="text-[10px] text-slate-500 max-w-sm mx-auto font-sans">
                            تم ترحيل جميع البصمات السابقة بنجاح. بمجرد قيام الموظفين بالبصم في أجهزتهم، ستظهر البصمات هنا فوراً وتلقائياً.
                          </p>
                        </div>
                      ) : (
                        <div className="border border-slate-800 rounded-xl overflow-hidden bg-slate-950/20 max-h-[350px] overflow-y-auto">
                          <table className="w-full text-right text-xs">
                            <thead className="bg-slate-950 text-slate-400 sticky top-0 z-10">
                              <tr className="border-b border-slate-800">
                                <th className="p-3 text-right">رقم الموظف في الجهاز (PIN)</th>
                                <th className="p-3 text-right">الموظف المطابق في النظام</th>
                                <th className="p-3 text-right">رقم جهاز البصمة (SN)</th>
                                <th className="p-3 text-right">وقت وتاريخ البصمة</th>
                                <th className="p-3 text-right">نوع الحركة الكاشفة</th>
                                <th className="p-3 text-left">حالة المطابقة الفورية</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-850">
                              {zkRawLogs.map((log) => {
                                const matched = employees.find(
                                  e => e.emp_id.trim().toLowerCase() === log.pin.trim().toLowerCase()
                                );
                                return (
                                  <tr key={log.id} className="hover:bg-slate-900/30 transition">
                                    <td className="p-3 font-mono font-bold text-slate-300 text-right">{log.pin}</td>
                                    <td className="p-3 text-right">
                                      {matched ? (
                                        <div className="flex items-center gap-2 justify-start font-sans">
                                          <div className="w-6 h-6 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 flex items-center justify-center text-[10px] font-bold">
                                            {matched.name.substring(0, 1)}
                                          </div>
                                          <div>
                                            <span className="font-bold text-slate-200 block">{matched.name}</span>
                                            <span className="text-[9px] text-slate-500 block">القسم: {matched.department || 'إداري'}</span>
                                          </div>
                                        </div>
                                      ) : (
                                        <div className="flex items-center gap-1.5 text-amber-400 bg-amber-500/5 px-2 py-1 rounded border border-amber-500/10 font-sans inline-flex">
                                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                                          <span className="text-[10px]">غير مطابق؛ تأكد من رقم الهوية {log.pin} للموظف</span>
                                        </div>
                                      )}
                                    </td>
                                    <td className="p-3 font-mono text-slate-400 text-[11px] text-right">{log.sn}</td>
                                    <td className="p-3 font-mono text-slate-300 text-right">{log.timestamp}</td>
                                    <td className="p-3 text-right">
                                      <span className="inline-flex items-center gap-1 text-[10px] bg-slate-900 text-slate-300 px-2 py-0.5 rounded border border-slate-800 font-sans">
                                        <span>بصمة إصبع</span>
                                      </span>
                                    </td>
                                    <td className="p-3 text-left">
                                      {matched ? (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 font-bold font-sans">
                                          <Check className="w-3 h-3" />
                                          <span>جاهز للمزامنة</span>
                                        </span>
                                      ) : (
                                        <span className="inline-flex items-center gap-1 text-[10px] text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20 font-sans">
                                          <AlertTriangle className="w-3 h-3" />
                                          <span>رقم ID غير مسجل</span>
                                        </span>
                                      )}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* SECTION 3: CONFIGURATION GUIDE */}
                  {zkSection === 'guide' && (
                    <div className="bg-slate-950/40 border border-slate-850 p-6 rounded-xl space-y-6 text-right leading-relaxed font-sans">
                      <div className="space-y-1">
                        <h4 className="text-sm font-bold text-slate-100 flex items-center gap-2 justify-end">
                          <Settings className="w-5 h-5 text-emerald-400" />
                          <span>كيفية ربط جهاز البصمة ZKTeco MP20 أونلاين بالسحابة مباشرة</span>
                        </h4>
                        <p className="text-xs text-slate-400">
                          بإمكانك ربط أي جهاز بصمة يدعم بروتوكول ADMS (سواء MP20 أو موديلات أخرى) ليرسل الحركات لحظياً لسحابتك الخاصة.
                        </p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                        {/* Steps */}
                        <div className="space-y-4 text-right">
                          <h5 className="text-xs font-bold text-emerald-400 border-b border-slate-800 pb-2 text-right">خطوات الإعداد على جهاز البصمة:</h5>
                          
                          <ol className="space-y-3 text-xs text-slate-300 list-decimal list-inside pr-2 font-sans text-right">
                            <li>
                              اضغط على زر <strong className="text-slate-100 font-bold">M/OK</strong> في جهاز البصمة لفتح القائمة الرئيسية.
                            </li>
                            <li>
                              انتقل إلى خيار <strong className="text-slate-100 font-bold">الاتصال (Comm.)</strong> ثم خيار <strong className="text-slate-100 font-bold">إعداد خادم السحاب (Cloud Server Setting)</strong> أو <strong className="text-slate-100 font-bold">ADMS</strong>.
                            </li>
                            <li>
                              قم بتفعيل الاتصال وخادم السحاب (Enable Cloud Server).
                            </li>
                            <li>
                              أدخل إعدادات خادم السحاب (Cloud Server / ADMS) بدقة كما يلي:
                              <div className="bg-slate-900 border-2 border-emerald-500/20 rounded-xl p-4 font-mono text-center mt-3 relative overflow-hidden shadow-xl shadow-emerald-950/10 text-right">
                                <div className="flex justify-between items-center w-full border-b border-slate-800/80 pb-2 mb-3">
                                  <span className="text-[10px] font-bold text-emerald-400 font-sans">بيانات خادم السحاب المعتمدة (ADMS Settings)</span>
                                  <span className="bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded text-[9px] font-sans font-bold">اتصال مباشر آمن 100%</span>
                                </div>

                                <div className="space-y-3">
                                  {/* Official Render Server Address */}
                                  <div className="space-y-1 text-right">
                                    <div className="text-[10px] text-slate-400 font-sans flex items-center justify-between">
                                      <span>1. عنوان خادم السحاب المباشر (Server Address على Render):</span>
                                      {copiedLink === 'official' && (
                                        <span className="text-emerald-400 font-bold text-[9px] animate-pulse">تم النسخ بنجاح!</span>
                                      )}
                                    </div>
                                    <div className="flex items-center justify-between gap-3 bg-slate-950/80 p-2.5 rounded-lg border border-slate-800">
                                      <div className="text-right flex-1 min-w-0">
                                        <span className="text-xs font-bold tracking-wider text-emerald-300 select-all font-mono">
                                          basmah-tech.onrender.com/adms
                                        </span>
                                      </div>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText('basmah-tech.onrender.com/adms');
                                          setCopiedLink('official');
                                          setTimeout(() => setCopiedLink(null), 2000);
                                        }}
                                        className="inline-flex items-center justify-center gap-1 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-slate-950 rounded text-[10px] font-sans font-extrabold transition-all duration-150 cursor-pointer shrink-0"
                                      >
                                        <Check className="w-3 h-3" />
                                        <span>نسخ</span>
                                      </button>
                                    </div>
                                  </div>

                                  {/* Server Port & Settings Table */}
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-right pt-1 font-sans">
                                    <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex justify-between items-center">
                                      <span className="text-[10px] text-slate-400">اسم النطاق (Enable Domain Name):</span>
                                      <span className="text-xs font-bold text-amber-400">On (مفعّل)</span>
                                    </div>
                                    <div className="bg-slate-950/70 p-2 rounded border border-slate-800 flex justify-between items-center">
                                      <span className="text-[10px] text-slate-400">المنفذ (Server Port):</span>
                                      <span className="text-xs font-bold text-emerald-400">80 <span className="text-[9px] text-slate-400 font-normal">(أو 443 لـ HTTPS)</span></span>
                                    </div>
                                  </div>
                                </div>

                                <p className="text-[10px] text-slate-400 leading-relaxed font-sans mt-3">
                                  💡 <strong className="text-amber-400">ملاحظة هامة:</strong> يدعم سيرفر (بصمة تك) استقبال ومعالجة طلبات أجهزة ZKTeco بشكل مباشر وسريع وترد الخدمة بحالة OK و 200 فورياً.
                                </p>
                              </div>
                            </li>
                            <li>
                              تأكد من اتصال جهاز البصمة بشبكة الواي فاي Wi-Fi أو الكابل.
                            </li>
                            <li>
                              سيقوم الجهاز بمصافحة السحابة والاتصال فورياً. تأكد من تفعيل "الرقم التسلسلي" للجهاز في الخيار (1) لتظهر البصمات في طابورك الخاص.
                            </li>
                          </ol>
                        </div>

                        {/* Tips */}
                        <div className="space-y-4 bg-slate-950/60 p-4 rounded-xl border border-slate-900 text-right">
                          <h5 className="text-xs font-bold text-amber-400 flex items-center gap-1 justify-end text-right">
                            <AlertTriangle className="w-4 h-4 text-amber-500" />
                            <span>ملاحظات هامة لضمان المطابقة:</span>
                          </h5>

                          <ul className="space-y-3 text-xs text-slate-400 list-disc list-inside text-right">
                            <li>
                              يجب أن يتطابق <strong className="text-slate-200 font-bold">رقم الموظف في جهاز البصمة (ID/PIN)</strong> مع <strong className="text-slate-200 font-bold">الرقم الوظيفي (ID)</strong> المسجل في بطاقة الموظف داخل هذا البرنامج لتتم مطابقة الحركات ووضعها في مكانها بنجاح.
                            </li>
                            <li>
                              يدعم بروتوكول ADMS السحابي كلاً من بصمات الأصابع، بصمات الوجه، والكروت الذكية المسجلة على الأجهزة.
                            </li>
                            <li>
                              يقوم خادم أبورتيل بحفظ البصمات الواردة بأمان في طابور معزول وخاص بحسابك، ولا يمكن لأي مؤسسة أخرى الاطلاع عليها.
                            </li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-slate-800 pt-4 flex justify-end items-center flex-shrink-0 mt-auto font-sans">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 bg-slate-950 border border-slate-850 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-lg text-xs font-bold transition cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
