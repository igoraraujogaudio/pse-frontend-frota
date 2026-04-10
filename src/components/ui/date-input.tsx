'use client';

import React, { useState, useEffect } from 'react';
import { Input } from './input';
import { Label } from './label';
import { CalendarIcon } from '@heroicons/react/24/outline';

interface DateInputProps {
  id?: string;
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  className?: string;
  label?: string;
  required?: boolean;
  disabled?: boolean;
}

export function DateInput({ 
  id, 
  value = '', 
  onChange, 
  placeholder = 'DD/MM/AAAA', 
  className = '', 
  label,
  required = false,
  disabled = false
}: DateInputProps) {
  const [displayValue, setDisplayValue] = useState('');
  const [isFocused, setIsFocused] = useState(false);

  // Converter formato ISO (YYYY-MM-DD) para brasileiro (DD/MM/YYYY)
  const formatToBrazilian = (isoDate: string) => {
    if (!isoDate) return '';
    try {
      // 🔒 FIX: Não usar Date() para evitar problemas de timezone
      // Parseia diretamente a string YYYY-MM-DD
      const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (match) {
        const [, year, month, day] = match;
        return `${day}/${month}/${year}`;
      }
      return '';
    } catch {
      return '';
    }
  };

  // Converter formato brasileiro (DD/MM/YYYY) para ISO (YYYY-MM-DD)
  const formatToISO = (brazilianDate: string) => {
    if (!brazilianDate) return '';
    
    // Remove caracteres não numéricos exceto barras
    const cleanDate = brazilianDate.replace(/[^\d\/]/g, '');
    
    // Se tem formato DD/MM/YYYY
    if (cleanDate.length === 10 && cleanDate.includes('/')) {
      const [day, month, year] = cleanDate.split('/');
      if (day && month && year && day.length === 2 && month.length === 2 && year.length === 4) {
        // 🔒 FIX: Validar a data sem usar timezone
        const dayNum = parseInt(day);
        const monthNum = parseInt(month);
        const yearNum = parseInt(year);
        
        // Validação básica
        if (monthNum < 1 || monthNum > 12) return '';
        if (dayNum < 1 || dayNum > 31) return '';
        if (yearNum < 1900 || yearNum > 2100) return '';
        
        // Validação de dias por mês
        const daysInMonth = new Date(yearNum, monthNum, 0).getDate();
        if (dayNum > daysInMonth) return '';
        
        // Retorna formato ISO diretamente (sem conversão de timezone)
        return `${year}-${month}-${day}`;
      }
    }
    
    return '';
  };

  // Atualizar displayValue quando value prop muda
  useEffect(() => {
    if (value && !isFocused) {
      setDisplayValue(formatToBrazilian(value));
    }
  }, [value, isFocused]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let inputValue = e.target.value;
    
    // Remove caracteres não numéricos exceto barras
    inputValue = inputValue.replace(/[^\d\/]/g, '');
    
    // Adiciona barras automaticamente
    if (inputValue.length >= 2 && !inputValue.includes('/')) {
      inputValue = inputValue.slice(0, 2) + '/' + inputValue.slice(2);
    }
    if (inputValue.length >= 5 && inputValue.split('/').length === 2) {
      inputValue = inputValue.slice(0, 5) + '/' + inputValue.slice(5, 9);
    }
    
    // Limita o tamanho
    if (inputValue.length > 10) {
      inputValue = inputValue.slice(0, 10);
    }
    
    setDisplayValue(inputValue);
    
    // Converte para ISO e chama onChange
    const isoValue = formatToISO(inputValue);
    if (onChange) {
      onChange(isoValue);
    }
  };

  const handleFocus = () => {
    setIsFocused(true);
    // Se está vazio, mostra placeholder
    if (!displayValue) {
      setDisplayValue('');
    }
  };

  const handleBlur = () => {
    setIsFocused(false);
    // Valida e formata a data ao perder o foco
    if (displayValue) {
      const isoValue = formatToISO(displayValue);
      if (isoValue) {
        setDisplayValue(formatToBrazilian(isoValue));
      } else {
        // Se não é uma data válida, limpa o campo
        setDisplayValue('');
        if (onChange) {
          onChange('');
        }
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Permite apenas números, barras, backspace, delete, tab, enter, escape, setas
    const allowedKeys = [
      'Backspace', 'Delete', 'Tab', 'Enter', 'Escape',
      'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown',
      'Home', 'End'
    ];
    
    if (allowedKeys.includes(e.key)) {
      return;
    }
    
    // Permite números e barra
    if (!/[\d\/]/.test(e.key)) {
      e.preventDefault();
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <Label htmlFor={id} className="text-sm font-semibold text-gray-700">
          {label}
          {required && <span className="text-red-500 ml-1">*</span>}
        </Label>
      )}
      <div className="relative">
        <Input
          id={id}
          type="text"
          value={displayValue}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className={`${className} ${isFocused ? 'ring-2 ring-blue-500 ring-opacity-50' : ''}`}
          disabled={disabled}
          maxLength={10}
        />
        <CalendarIcon className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
      </div>
    </div>
  );
}



