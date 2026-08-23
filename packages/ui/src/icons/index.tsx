import * as React from "react";
import {
  AddressBook as PhAddressBook,
  ArrowDown as PhArrowDown,
  ArrowLeft as PhArrowLeft,
  ArrowRight as PhArrowRight,
  ArrowSquareOut as PhArrowSquareOut,
  ArrowUp as PhArrowUp,
  ArrowUpRight as PhArrowUpRight,
  ArrowsClockwise as PhArrowsClockwise,
  ArrowsLeftRight as PhArrowsLeftRight,
  ArrowsOutSimple as PhArrowsOutSimple,
  Barcode as PhBarcode,
  Bell as PhBell,
  BookBookmark as PhBookBookmark,
  BookOpenText as PhBookOpenText,
  Buildings as PhBuildings,
  Calendar as PhCalendar,
  CaretDown as PhCaretDown,
  CaretLeft as PhCaretLeft,
  CaretRight as PhCaretRight,
  CaretUpDown as PhCaretUpDown,
  ChartBar as PhChartBar,
  ChartLine as PhChartLine,
  ChartLineUp as PhChartLineUp,
  Chat as PhChat,
  ChatCircle as PhChatCircle,
  Check as PhCheck,
  CheckCircle as PhCheckCircle,
  Checks as PhChecks,
  Circle as PhCircle,
  Clipboard as PhClipboard,
  ClipboardText as PhClipboardText,
  Clock as PhClock,
  CloudArrowUp as PhCloudArrowUp,
  Code as PhCode,
  Columns as PhColumns,
  Copy as PhCopy,
  CreditCard as PhCreditCard,
  Cube as PhCube,
  CubeFocus as PhCubeFocus,
  CurrencyCircleDollar as PhCurrencyCircleDollar,
  CurrencyDollar as PhCurrencyDollar,
  Database as PhDatabase,
  Desktop as PhDesktop,
  DotsThree as PhDotsThree,
  DotsThreeVertical as PhDotsThreeVertical,
  DownloadSimple as PhDownloadSimple,
  EnvelopeSimple as PhEnvelopeSimple,
  Eye as PhEye,
  EyeSlash as PhEyeSlash,
  Factory as PhFactory,
  FileArrowUp as PhFileArrowUp,
  FileText as PhFileText,
  FileXls as PhFileXls,
  Funnel as PhFunnel,
  Gear as PhGear,
  GearSix as PhGearSix,
  GitBranch as PhGitBranch,
  Globe as PhGlobe,
  GoogleLogo as PhGoogleLogo,
  Handshake as PhHandshake,
  Hash as PhHash,
  Image as PhImage,
  Images as PhImages,
  Info as PhInfo,
  Pulse as PhPulse,
  Key as PhKey,
  Layout as PhLayout,
  Link as PhLink,
  List as PhList,
  ListChecks as PhListChecks,
  LockKey as PhLockKey,
  MagnifyingGlass as PhMagnifyingGlass,
  MapPin as PhMapPin,
  Moon as PhMoon,
  Megaphone as PhMegaphone,
  Note as PhNote,
  Package as PhPackage,
  PencilSimple as PhPencilSimple,
  Phone as PhPhone,
  Plus as PhPlus,
  Prohibit as PhProhibit,
  Receipt as PhReceipt,
  Recycle as PhRecycle,
  Robot as PhRobot,
  Rows as PhRows,
  SealCheck as PhSealCheck,
  SealPercent as PhSealPercent,
  ShareNetwork as PhShareNetwork,
  Shield as PhShield,
  ShieldCheck as PhShieldCheck,
  ShieldWarning as PhShieldWarning,
  ShoppingCartSimple as PhShoppingCartSimple,
  SignOut as PhSignOut,
  SlidersHorizontal as PhSlidersHorizontal,
  SpinnerGap as PhSpinnerGap,
  SquaresFour as PhSquaresFour,
  Stack as PhStack,
  Star as PhStar,
  Sun as PhSun,
  StackSimple as PhStackSimple,
  Table as PhTable,
  Tag as PhTag,
  TextB as PhTextB,
  TextItalic as PhTextItalic,
  TextStrikethrough as PhTextStrikethrough,
  Trash as PhTrash,
  TrashSimple as PhTrashSimple,
  TrendDown as PhTrendDown,
  TrendUp as PhTrendUp,
  Truck as PhTruck,
  UploadSimple as PhUploadSimple,
  User as PhUser,
  UserCheck as PhUserCheck,
  UserGear as PhUserGear,
  Users as PhUsers,
  VideoCamera as PhVideoCamera,
  Wallet as PhWallet,
  Warehouse as PhWarehouse,
  WindowsLogo as PhWindowsLogo,
  Warning as PhWarning,
  WarningCircle as PhWarningCircle,
  WarningOctagon as PhWarningOctagon,
  X as PhX,
  XCircle as PhXCircle,
} from "@phosphor-icons/react/ssr";
import type { Icon, IconProps, IconWeight } from "@phosphor-icons/react";

/**
 * The single source of truth for every icon in the product.
 *
 * Nothing outside this file may import from an icon package directly — import
 * the named icon from `@repo/ui/icons` instead. Swapping a glyph, or the whole
 * icon set, then happens in one place.
 *
 * Every icon renders in Phosphor’s **duotone** weight by default. Pass an
 * explicit `weight` prop to opt a single instance out.
 */

export type { IconProps, IconWeight };

/** The shape every exported icon conforms to. Use this to type icon props. */
export type IconComponent = Icon;

/**
 * Wraps a Phosphor icon so it defaults to the duotone weight.
 *
 * Each call carries a pure annotation so bundlers can drop the icons a
 * given entry point never references, despite this barrel re-exporting all of
 * them.
 */
function duotone(Base: Icon, displayName: string): IconComponent {
  const Wrapped = React.forwardRef<SVGSVGElement, IconProps>(
    ({ weight = "duotone", ...props }, ref) => (
      <Base ref={ref} weight={weight} {...props} />
    )
  );
  Wrapped.displayName = displayName;
  return Wrapped;
}

export const AlertCircle = /*#__PURE__*/ duotone(
  PhWarningCircle,
  "AlertCircle"
);
export const AlertTriangle = /*#__PURE__*/ duotone(PhWarning, "AlertTriangle");
export const ArrowDownIcon = /*#__PURE__*/ duotone(
  PhArrowDown,
  "ArrowDownIcon"
);
export const ArrowLeft = /*#__PURE__*/ duotone(PhArrowLeft, "ArrowLeft");
export const ArrowLeftRight = /*#__PURE__*/ duotone(
  PhArrowsLeftRight,
  "ArrowLeftRight"
);
export const ArrowRight = /*#__PURE__*/ duotone(PhArrowRight, "ArrowRight");
export const ArrowRightLeft = /*#__PURE__*/ duotone(
  PhArrowsLeftRight,
  "ArrowRightLeft"
);
export const ArrowUpIcon = /*#__PURE__*/ duotone(PhArrowUp, "ArrowUpIcon");
export const ArrowUpRight = /*#__PURE__*/ duotone(
  PhArrowUpRight,
  "ArrowUpRight"
);
export const BadgeCheck = /*#__PURE__*/ duotone(PhSealCheck, "BadgeCheck");
export const BadgePercent = /*#__PURE__*/ duotone(
  PhSealPercent,
  "BadgePercent"
);
export const Ban = /*#__PURE__*/ duotone(PhProhibit, "Ban");
export const BarChart = /*#__PURE__*/ duotone(PhChartBar, "BarChart");
export const Bell = /*#__PURE__*/ duotone(PhBell, "Bell");
export const Bold = /*#__PURE__*/ duotone(PhTextB, "Bold");
export const BookAIcon = /*#__PURE__*/ duotone(PhBookOpenText, "BookAIcon");
export const BookCheckIcon = /*#__PURE__*/ duotone(
  PhBookBookmark,
  "BookCheckIcon"
);
export const BookUser = /*#__PURE__*/ duotone(PhAddressBook, "BookUser");
export const Bot = /*#__PURE__*/ duotone(PhRobot, "Bot");
export const Boxes = /*#__PURE__*/ duotone(PhStack, "Boxes");
export const Building2 = /*#__PURE__*/ duotone(PhBuildings, "Building2");
export const Calendar = /*#__PURE__*/ duotone(PhCalendar, "Calendar");
export const ChartColumnIcon = /*#__PURE__*/ duotone(
  PhChartBar,
  "ChartColumnIcon"
);
export const ChartNoAxesCombined = /*#__PURE__*/ duotone(
  PhChartLineUp,
  "ChartNoAxesCombined"
);
export const Check = /*#__PURE__*/ duotone(PhCheck, "Check");
export const CheckCheck = /*#__PURE__*/ duotone(PhChecks, "CheckCheck");
export const CheckCircle = /*#__PURE__*/ duotone(PhCheckCircle, "CheckCircle");
export const CheckCircle2 = /*#__PURE__*/ duotone(
  PhCheckCircle,
  "CheckCircle2"
);
export const ChevronDown = /*#__PURE__*/ duotone(PhCaretDown, "ChevronDown");
export const ChevronLeft = /*#__PURE__*/ duotone(PhCaretLeft, "ChevronLeft");
export const ChevronRight = /*#__PURE__*/ duotone(PhCaretRight, "ChevronRight");
export const ChevronsUpDown = /*#__PURE__*/ duotone(
  PhCaretUpDown,
  "ChevronsUpDown"
);
export const ChevronsUpDownIcon = /*#__PURE__*/ duotone(
  PhCaretUpDown,
  "ChevronsUpDownIcon"
);
export const Circle = /*#__PURE__*/ duotone(PhCircle, "Circle");
export const CircleCheckIcon = /*#__PURE__*/ duotone(
  PhCheckCircle,
  "CircleCheckIcon"
);
export const CircleDollarSign = /*#__PURE__*/ duotone(
  PhCurrencyCircleDollar,
  "CircleDollarSign"
);
export const ClipboardCheck = /*#__PURE__*/ duotone(
  PhClipboardText,
  "ClipboardCheck"
);
export const ClipboardList = /*#__PURE__*/ duotone(
  PhClipboard,
  "ClipboardList"
);
export const Clock = /*#__PURE__*/ duotone(PhClock, "Clock");
export const Code = /*#__PURE__*/ duotone(PhCode, "Code");
export const Columns = /*#__PURE__*/ duotone(PhColumns, "Columns");
export const Component = /*#__PURE__*/ duotone(PhCube, "Component");
export const Copy = /*#__PURE__*/ duotone(PhCopy, "Copy");
export const CreditCard = /*#__PURE__*/ duotone(PhCreditCard, "CreditCard");
export const Database = /*#__PURE__*/ duotone(PhDatabase, "Database");
export const Desktop = /*#__PURE__*/ duotone(PhDesktop, "Desktop");
export const DollarSign = /*#__PURE__*/ duotone(PhCurrencyDollar, "DollarSign");
export const Download = /*#__PURE__*/ duotone(PhDownloadSimple, "Download");
export const Edit = /*#__PURE__*/ duotone(PhPencilSimple, "Edit");
export const ExternalLink = /*#__PURE__*/ duotone(
  PhArrowSquareOut,
  "ExternalLink"
);
export const Eye = /*#__PURE__*/ duotone(PhEye, "Eye");
export const EyeOff = /*#__PURE__*/ duotone(PhEyeSlash, "EyeOff");
export const Factory = /*#__PURE__*/ duotone(PhFactory, "Factory");
export const FileCheck2 = /*#__PURE__*/ duotone(PhClipboardText, "FileCheck2");
export const FileSpreadsheet = /*#__PURE__*/ duotone(
  PhFileXls,
  "FileSpreadsheet"
);
export const FileText = /*#__PURE__*/ duotone(PhFileText, "FileText");
export const FileUp = /*#__PURE__*/ duotone(PhFileArrowUp, "FileUp");
export const Filter = /*#__PURE__*/ duotone(PhFunnel, "Filter");
export const GitBranch = /*#__PURE__*/ duotone(PhGitBranch, "GitBranch");
export const Globe = /*#__PURE__*/ duotone(PhGlobe, "Globe");
export const GoogleLogo = /*#__PURE__*/ duotone(PhGoogleLogo, "GoogleLogo");
export const Handshake = /*#__PURE__*/ duotone(PhHandshake, "Handshake");
export const Hash = /*#__PURE__*/ duotone(PhHash, "Hash");
export const Image = /*#__PURE__*/ duotone(PhImage, "Image");
export const ImageIcon = /*#__PURE__*/ duotone(PhImage, "ImageIcon");
export const ImagePlus = /*#__PURE__*/ duotone(PhImages, "ImagePlus");
export const Activity = /*#__PURE__*/ duotone(PhPulse, "Activity");
export const Info = /*#__PURE__*/ duotone(PhInfo, "Info");
export const InfoIcon = /*#__PURE__*/ duotone(PhInfo, "InfoIcon");
export const Italic = /*#__PURE__*/ duotone(PhTextItalic, "Italic");
export const KeyRound = /*#__PURE__*/ duotone(PhKey, "KeyRound");
export const Layers = /*#__PURE__*/ duotone(PhStackSimple, "Layers");
export const LayoutGrid = /*#__PURE__*/ duotone(PhSquaresFour, "LayoutGrid");
export const LayoutTemplate = /*#__PURE__*/ duotone(PhLayout, "LayoutTemplate");
export const LineChart = /*#__PURE__*/ duotone(PhChartLine, "LineChart");
export const Link2 = /*#__PURE__*/ duotone(PhLink, "Link2");
export const ListChecks = /*#__PURE__*/ duotone(PhListChecks, "ListChecks");
export const Loader2 = /*#__PURE__*/ duotone(PhSpinnerGap, "Loader2");
export const Loader2Icon = /*#__PURE__*/ duotone(PhSpinnerGap, "Loader2Icon");
export const LockKeyhole = /*#__PURE__*/ duotone(PhLockKey, "LockKeyhole");
export const LogOut = /*#__PURE__*/ duotone(PhSignOut, "LogOut");
export const Mail = /*#__PURE__*/ duotone(PhEnvelopeSimple, "Mail");
export const MapPin = /*#__PURE__*/ duotone(PhMapPin, "MapPin");
export const Maximize2 = /*#__PURE__*/ duotone(PhArrowsOutSimple, "Maximize2");
export const Megaphone = /*#__PURE__*/ duotone(PhMegaphone, "Megaphone");
export const Menu = /*#__PURE__*/ duotone(PhList, "Menu");
export const MessageCircle = /*#__PURE__*/ duotone(
  PhChatCircle,
  "MessageCircle"
);
export const MessageSquare = /*#__PURE__*/ duotone(PhChat, "MessageSquare");
export const Moon = /*#__PURE__*/ duotone(PhMoon, "Moon");
export const MoreHorizontal = /*#__PURE__*/ duotone(
  PhDotsThree,
  "MoreHorizontal"
);
export const MoreVertical = /*#__PURE__*/ duotone(
  PhDotsThreeVertical,
  "MoreVertical"
);
export const OctagonXIcon = /*#__PURE__*/ duotone(
  PhWarningOctagon,
  "OctagonXIcon"
);
export const Package = /*#__PURE__*/ duotone(PhPackage, "Package");
export const PackageCheck = /*#__PURE__*/ duotone(PhPackage, "PackageCheck");
export const PackageSearch = /*#__PURE__*/ duotone(
  PhCubeFocus,
  "PackageSearch"
);
export const Pencil = /*#__PURE__*/ duotone(PhPencilSimple, "Pencil");
export const Phone = /*#__PURE__*/ duotone(PhPhone, "Phone");
export const Plus = /*#__PURE__*/ duotone(PhPlus, "Plus");
export const ReceiptText = /*#__PURE__*/ duotone(PhReceipt, "ReceiptText");
export const Recycle = /*#__PURE__*/ duotone(PhRecycle, "Recycle");
export const RefreshCw = /*#__PURE__*/ duotone(PhArrowsClockwise, "RefreshCw");
export const ScanBarcode = /*#__PURE__*/ duotone(PhBarcode, "ScanBarcode");
export const Search = /*#__PURE__*/ duotone(PhMagnifyingGlass, "Search");
export const Settings = /*#__PURE__*/ duotone(PhGear, "Settings");
export const Settings2 = /*#__PURE__*/ duotone(PhGearSix, "Settings2");
export const Share2 = /*#__PURE__*/ duotone(PhShareNetwork, "Share2");
export const Shield = /*#__PURE__*/ duotone(PhShield, "Shield");
export const ShieldAlert = /*#__PURE__*/ duotone(
  PhShieldWarning,
  "ShieldAlert"
);
export const ShieldCheck = /*#__PURE__*/ duotone(PhShieldCheck, "ShieldCheck");
export const ShoppingCart = /*#__PURE__*/ duotone(
  PhShoppingCartSimple,
  "ShoppingCart"
);
export const SlidersHorizontal = /*#__PURE__*/ duotone(
  PhSlidersHorizontal,
  "SlidersHorizontal"
);
export const Star = /*#__PURE__*/ duotone(PhStar, "Star");
export const StickyNote = /*#__PURE__*/ duotone(PhNote, "StickyNote");
export const Strikethrough = /*#__PURE__*/ duotone(
  PhTextStrikethrough,
  "Strikethrough"
);
export const Sun = /*#__PURE__*/ duotone(PhSun, "Sun");
export const Table = /*#__PURE__*/ duotone(PhTable, "Table");
export const TableProperties = /*#__PURE__*/ duotone(PhRows, "TableProperties");
export const Tag = /*#__PURE__*/ duotone(PhTag, "Tag");
export const Trash = /*#__PURE__*/ duotone(PhTrash, "Trash");
export const Trash2 = /*#__PURE__*/ duotone(PhTrashSimple, "Trash2");
export const TrendingDown = /*#__PURE__*/ duotone(PhTrendDown, "TrendingDown");
export const TrendingUp = /*#__PURE__*/ duotone(PhTrendUp, "TrendingUp");
export const TriangleAlert = /*#__PURE__*/ duotone(PhWarning, "TriangleAlert");
export const TriangleAlertIcon = /*#__PURE__*/ duotone(
  PhWarning,
  "TriangleAlertIcon"
);
export const Truck = /*#__PURE__*/ duotone(PhTruck, "Truck");
export const Upload = /*#__PURE__*/ duotone(PhUploadSimple, "Upload");
export const UploadCloud = /*#__PURE__*/ duotone(PhCloudArrowUp, "UploadCloud");
export const User = /*#__PURE__*/ duotone(PhUser, "User");
export const UserCheck = /*#__PURE__*/ duotone(PhUserCheck, "UserCheck");
export const UserLock = /*#__PURE__*/ duotone(PhUserGear, "UserLock");
export const Users = /*#__PURE__*/ duotone(PhUsers, "Users");
export const Video = /*#__PURE__*/ duotone(PhVideoCamera, "Video");
export const Wallet = /*#__PURE__*/ duotone(PhWallet, "Wallet");
export const Warehouse = /*#__PURE__*/ duotone(PhWarehouse, "Warehouse");
export const WindowsLogo = /*#__PURE__*/ duotone(PhWindowsLogo, "WindowsLogo");
export const X = /*#__PURE__*/ duotone(PhX, "X");
export const XCircle = /*#__PURE__*/ duotone(PhXCircle, "XCircle");
