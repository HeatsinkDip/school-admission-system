import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (newPage: number) => void;
  className?: string;
  itemLabel?: string;
}

export const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  className = '',
  itemLabel = 'records',
}) => {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  if (totalItems === 0) return null;

  const startIndex = (currentPage - 1) * pageSize + 1;
  const endIndex = Math.min(totalItems, currentPage * pageSize);

  // Generate page numbers to display (smart window around current page)
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (currentPage > 3) pages.push('...');
      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (currentPage < totalPages - 2) pages.push('...');
      pages.push(totalPages);
    }
    return pages;
  };

  return (
    <div className={`pagination-container ${className}`}>
      <div className="pagination-info text-sm text-slate-500">
        Showing <strong className="text-slate-800">{startIndex}</strong> to{' '}
        <strong className="text-slate-800">{endIndex}</strong> of{' '}
        <strong className="text-slate-800">{totalItems}</strong> {itemLabel}
      </div>

      {totalPages > 1 && (
        <div className="pagination-controls flex items-center gap-1">
          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage <= 1}
            title="Previous Page"
            data-testid="pagination-prev"
          >
            <ChevronLeft size={16} />
            <span className="sr-only">Previous</span>
          </button>

          {getPageNumbers().map((p, idx) =>
            typeof p === 'number' ? (
              <button
                key={p}
                type="button"
                className={`pagination-btn ${p === currentPage ? 'active' : ''}`}
                onClick={() => onPageChange(p)}
                data-testid={`pagination-page-${p}`}
              >
                {p}
              </button>
            ) : (
              <span key={`ellipsis-${idx}`} className="pagination-ellipsis px-1 text-slate-400">
                ...
              </span>
            ),
          )}

          <button
            type="button"
            className="pagination-btn"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages}
            title="Next Page"
            data-testid="pagination-next"
          >
            <ChevronRight size={16} />
            <span className="sr-only">Next</span>
          </button>
        </div>
      )}
    </div>
  );
};

